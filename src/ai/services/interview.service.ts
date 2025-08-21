import { Inject, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import * as pdfParse from 'pdf-parse';
import { PrismaService } from 'src/prisma/prisma.service';
import { PROVIDER_TOKENS } from '../constants/provider-tokens';
import { SubmitAnswerDto } from '../dto/interview.dto';
import { IAiProvider } from '../interfaces/ai-provider.interface';
import { InterviewGateway } from '../interview.gateway';
import { PlanLimitsService } from './plan-limits.service';

@Injectable()
export class InterviewService {
  private readonly TIMEOUT_MARKER = '__TIMEOUT__';

  constructor(
    private readonly prisma: PrismaService,
    @Inject(PROVIDER_TOKENS.GROQ_AI_PROVIDER) private readonly aiProvider: IAiProvider,
    private readonly planLimitsService: PlanLimitsService,
    private readonly gateway: InterviewGateway,
  ) {}

  async startInterviewFromResume(file: Express.Multer.File, userId: string): Promise<{
    success: boolean;
    message: string;
    data: { sessionId: string; totalQuestions: number };
  }> {
    // Enforce plan limits before starting
    await this.planLimitsService.enforceInterviewLimit(userId);
    await this.planLimitsService.enforceResumeUploadLimit(userId);

    const pdfData = await pdfParse(file.buffer);
    const resumeText = pdfData.text;

    // Generate questions using AI provider
    const questions = await this.aiProvider.generateQuestions(resumeText);

    // Create interview session
    const session = await this.prisma.interviewSession.create({
      data: {
        userId,
        resumeText,
        resumeName: file.originalname,
        resumeMime: file.mimetype,
        status: 'IN_PROGRESS',
        startedAt: new Date(),
      },
    });

    // Persist questions
    await this.prisma.interviewQuestion.createMany({
      data: questions.map((q) => ({
        sessionId: session.id,
        category: q.category,
        text: q.text,
        order: q.order,
        maxScore: 10,
      })),
    });

    await this.prisma.interviewSession.update({
      where: { id: session.id },
      data: { questionCount: questions.length },
    });

    const result = {
      success: true,
      message: 'Interview started',
      data: { sessionId: session.id, totalQuestions: questions.length },
    };
    
    this.gateway.emitToSession(session.id, 'interview:started', result.data);
    return result;
  }

  async getNextQuestion(sessionId: string, userId: string): Promise<{
    success: boolean;
    message: string;
    data: any;
  }> {
    const session = await this.prisma.interviewSession.findFirst({ 
      where: { id: sessionId, userId } 
    });
    
    if (!session) throw new NotFoundException('Interview session not found');
    
    if (session.status === 'COMPLETED') {
      return { success: true, message: 'Interview completed', data: null };
    }

    const [questions, answers] = await Promise.all([
      this.prisma.interviewQuestion.findMany({ 
        where: { sessionId }, 
        orderBy: { order: 'asc' } 
      }),
      this.prisma.interviewAnswer.findMany({ 
        where: { sessionId, userId } 
      }),
    ]);

    const answeredIds = new Set(answers.map((a) => a.questionId));
    const next = questions.find((q) => !answeredIds.has(q.id));

    if (!next) {
      // Mark completed and compute summary
      const totals = await this.computeScore(sessionId, userId);
      await this.prisma.interviewSession.update({
        where: { id: sessionId },
        data: { 
          status: 'COMPLETED', 
          completedAt: new Date(), 
          totalScore: totals.totalScore, 
          maxScore: totals.maxScore 
        },
      });
      return { success: true, message: 'Interview completed', data: null };
    }

    const remaining = questions.length - answers.length;
    const result = {
      success: true,
      message: 'Next question',
      data: {
        questionId: next.id,
        text: next.text,
        category: next.category,
        order: next.order,
        remaining,
      },
    };
    
    this.gateway.emitToSession(sessionId, 'question:next', result.data);
    return result;
  }

  async submitAnswer(sessionId: string, userId: string, body: SubmitAnswerDto): Promise<{
    success: boolean;
    message: string;
    data: { answerId: string };
  }> {
    const session = await this.prisma.interviewSession.findFirst({ 
      where: { id: sessionId, userId } 
    });
    
    if (!session) throw new NotFoundException('Interview session not found');
    if (session.status === 'COMPLETED') throw new UnauthorizedException('Interview already completed');

    const question = await this.prisma.interviewQuestion.findFirst({ 
      where: { id: body.questionId, sessionId } 
    });
    
    if (!question) throw new NotFoundException('Question not found');

    // Upsert answer (one per sessionId+questionId+userId)
    const answer = await this.storeAnswer(
      sessionId, 
      userId, 
      question.id, 
      body.answerText.trim(), 
      'TEXT'
    );
    
    const res = {
      success: true,
      message: 'Answer submitted',
      data: { answerId: answer.id },
    };
    
    this.gateway.emitToSession(sessionId, 'answer:submitted', { 
      questionId: question.id, 
      answerId: res.data.answerId 
    });
    
    return res;
  }

  async transcribeAndStoreAnswer(
    sessionId: string,
    userId: string,
    questionId: string,
    audio: Express.Multer.File,
  ): Promise<{
    success: boolean;
    message: string;
    data: { answerId: string };
  }> {
    const session = await this.prisma.interviewSession.findFirst({ 
      where: { id: sessionId, userId } 
    });
    
    if (!session) throw new NotFoundException('Interview session not found');

    // Transcribe via AI provider
    const text = await this.aiProvider.transcribeAudio(audio);

    // Store answer without grading, include transcription metadata
    const question = await this.prisma.interviewQuestion.findFirst({ 
      where: { id: questionId, sessionId } 
    });
    
    if (!question) throw new NotFoundException('Question not found');
    
    const answer = await this.storeAnswer(sessionId, userId, questionId, text, 'AUDIO');
    
    const res = {
      success: true,
      message: 'Answer submitted',
      data: { answerId: answer.id },
    };
    
    this.gateway.emitToSession(sessionId, 'answer:submitted', { 
      questionId, 
      answerId: res.data.answerId 
    });
    
    return res;
  }

  async gradeInterview(sessionId: string, userId: string): Promise<{
    success: boolean;
    message: string;
    data: { results: Array<{ answerId: string; questionId: string; score: number; feedback: string }> };
  }> {
    const session = await this.prisma.interviewSession.findFirst({ 
      where: { id: sessionId, userId } 
    });
    
    if (!session) throw new NotFoundException('Interview session not found');

    const questions = await this.prisma.interviewQuestion.findMany({ where: { sessionId } });
    const answers = await this.prisma.interviewAnswer.findMany({ where: { sessionId, userId } });
    const questionById = new Map(questions.map((q) => [q.id, q] as const));

    const gradedResults: Array<{ answerId: string; questionId: string; score: number; feedback: string }> = [];
    
    for (const answer of answers) {
      if (answer.answerText === this.TIMEOUT_MARKER) continue;
      
      const question = questionById.get(answer.questionId);
      if (!question) continue;
      
      const { score, feedback } = await this.aiProvider.gradeAnswer(
        question.text, 
        answer.answerText, 
        question.maxScore
      );

      const updated = await this.prisma.interviewAnswer.update({ 
        where: { id: answer.id }, 
        data: { 
          aiFeedback: feedback, 
          score, 
          gradedAt: new Date() 
        } 
      });
      
      gradedResults.push({ 
        answerId: updated.id, 
        questionId: updated.questionId, 
        score: updated.score ?? 0, 
        feedback: updated.aiFeedback ?? '' 
      });
    }

    // Update session totals if all questions are answered
    const allAnswered = answers.length >= questions.length && questions.length > 0;
    if (allAnswered) {
      const totals = await this.computeScore(sessionId, userId);
      await this.prisma.interviewSession.update({
        where: { id: sessionId },
        data: { 
          status: 'COMPLETED', 
          completedAt: new Date(), 
          gradedAt: new Date(), 
          totalScore: totals.totalScore, 
          maxScore: totals.maxScore 
        },
      });
    }

    const out = {
      success: true,
      message: 'Interview graded',
      data: { results: gradedResults },
    };
    
    this.gateway.emitToSession(sessionId, 'interview:graded', out.data);
    return out;
  }

  async timeoutAnswer(
    sessionId: string,
    userId: string,
    questionId: string,
  ): Promise<{ success: boolean }> {
    // Ensure question exists and belongs to session
    const question = await this.prisma.interviewQuestion.findFirst({ 
      where: { id: questionId, sessionId } 
    });
    
    if (!question) throw new NotFoundException('Question not found');

    await this.prisma.interviewAnswer.upsert({
      where: {
        sessionId_questionId_userId: {
          sessionId,
          questionId,
          userId,
        },
      },
      create: {
        sessionId,
        questionId,
        userId,
        answerText: this.TIMEOUT_MARKER,
        source: 'TEXT',
      },
      update: {
        answerText: this.TIMEOUT_MARKER,
        source: 'TEXT',
        aiFeedback: null,
        score: null,
        gradedAt: null,
      },
    });

    this.gateway.emitToSession(sessionId, 'answer:submitted', { 
      questionId, 
      timedOut: true 
    });
    
    return { success: true };
  }

  async getQuestionsWithStatus(sessionId: string, userId: string): Promise<{
    success: boolean;
    message: string;
    data: Array<{
      questionId: string;
      text: string;
      category: 'TECHNICAL' | 'PROJECTS' | 'BEHAVIORAL';
      order: number;
      answered: boolean;
    }>;
  }> {
    const session = await this.prisma.interviewSession.findFirst({ 
      where: { id: sessionId, userId } 
    });
    
    if (!session) throw new NotFoundException('Interview session not found');

    const [questions, answers] = await Promise.all([
      this.prisma.interviewQuestion.findMany({ 
        where: { sessionId }, 
        orderBy: { order: 'asc' } 
      }),
      this.prisma.interviewAnswer.findMany({ 
        where: { sessionId, userId } 
      }),
    ]);
    
    const answered = new Set(
      answers
        .filter((a) => a.answerText !== this.TIMEOUT_MARKER)
        .map((a) => a.questionId)
    );
    
    const items = questions.map((q) => ({
      questionId: q.id,
      text: q.text,
      category: q.category,
      order: q.order,
      answered: answered.has(q.id),
    }));
    
    return {
      success: true,
      message: 'Questions with status',
      data: items,
    };
  }

  async getInterviewSummary(sessionId: string, userId: string): Promise<{
    success: boolean;
    message: string;
    data: {
      sessionId: string;
      status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
      totalScore?: number;
      maxScore?: number;
      answered: number;
      totalQuestions: number;
    };
  }> {
    const session = await this.prisma.interviewSession.findFirst({ 
      where: { id: sessionId, userId } 
    });
    
    if (!session) throw new NotFoundException('Interview session not found');

    const [questionsCount, answers] = await Promise.all([
      this.prisma.interviewQuestion.count({ where: { sessionId } }),
      this.prisma.interviewAnswer.findMany({ where: { sessionId, userId } }),
    ]);

    const totalScore = answers.reduce((sum, a) => sum + (a.score ?? 0), 0);
    const maxScore = await this.prisma.interviewQuestion.aggregate({
      _sum: { maxScore: true },
      where: { sessionId },
    });

    return {
      success: true,
      message: 'Interview summary',
      data: {
        sessionId: session.id,
        status: session.status,
        totalScore: session.totalScore ?? totalScore,
        maxScore: session.maxScore ?? (maxScore._sum.maxScore ?? 0),
        answered: answers.length,
        totalQuestions: questionsCount,
      },
    };
  }

  async generateQuestionsFromResume(file: Express.Multer.File): Promise<{
    success: boolean;
    message: string;
    data: Array<{
      text: string;
      category: 'TECHNICAL' | 'PROJECTS' | 'BEHAVIORAL';
      order: number;
    }>;
  }> {
    const pdfData = await pdfParse(file.buffer);
    const resumeText = pdfData.text;

    // Generate questions using AI provider
    const questions = await this.aiProvider.generateQuestions(resumeText);

    return {
      success: true,
      message: 'Questions generated successfully',
      data: questions
    };
  }

  private async computeScore(sessionId: string, userId: string): Promise<{ totalScore: number; maxScore: number }> {
    const [answers, questions] = await Promise.all([
      this.prisma.interviewAnswer.findMany({ where: { sessionId, userId } }),
      this.prisma.interviewQuestion.findMany({ where: { sessionId } }),
    ]);
    
    const totalScore = answers.reduce((sum, a) => sum + (a.score ?? 0), 0);
    const maxScore = questions.reduce((sum, q) => sum + q.maxScore, 0);
    
    return { totalScore, maxScore };
  }

  private async storeAnswer(
    sessionId: string,
    userId: string,
    questionId: string,
    answerText: string,
    source: 'TEXT' | 'AUDIO',
    transcriptionMeta?: unknown,
  ) {
    const upserted = await this.prisma.interviewAnswer.upsert({
      where: {
        sessionId_questionId_userId: {
          sessionId,
          questionId,
          userId,
        },
      },
      create: {
        sessionId,
        questionId,
        userId,
        answerText,
        source,
        transcriptionMeta: transcriptionMeta as any,
      },
      update: {
        answerText,
        source,
        transcriptionMeta: transcriptionMeta as any,
        aiFeedback: null,
        score: null,
        gradedAt: null,
      },
    });
    
    return upserted;
  }
}
