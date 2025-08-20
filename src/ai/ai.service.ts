import { GoogleGenAI } from '@google/genai';
import { Inject, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Groq from 'groq-sdk';
import * as pdfParse from 'pdf-parse';
import { PrismaService } from 'src/prisma/prisma.service';
import { SubmitAnswerDto } from './dto/interview.dto';
import { InterviewGateway } from './interview.gateway';

@Injectable()
export class AiService {
  constructor(
    @Inject('GEMINI') private readonly gemini: GoogleGenAI,
    @Inject('GROQ') private readonly groq: Groq,
    private readonly prisma: PrismaService,
    private readonly gateway: InterviewGateway,
    private readonly configService: ConfigService,
  ) {}

  public async createChatSession(userId: string, options?: {
    title?: string;
    temperature?: number;
    maxTokens?: number;
    model?: string;
  }) {
    const session = await this.prisma.chatSession.create({
      data: {
        userId,
        title: options?.title || 'New Chat',
        temperature: options?.temperature || 0.7,
        maxTokens: options?.maxTokens || 4096,
        model: options?.model || 'gemini-2.0-flash-exp',
      },
      include: {
        messages: true,
      },
    });

    return {
      success: true,
      message: 'Chat session created successfully',
      data: session,
    };
  }

  public async getChatSessions(userId: string) {
    const sessions = await this.prisma.chatSession.findMany({
      where: {
        userId,
        isActive: true,
      },
      include: {
        messages: {
          orderBy: {
            createdAt: 'asc',
          },
        },
        _count: {
          select: {
            messages: true,
          },
        },
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });

    return {
      success: true,
      message: 'Chat sessions retrieved successfully',
      data: sessions,
    };
  }

  public async getChatSession(sessionId: string, userId: string) {
    const session = await this.prisma.chatSession.findFirst({
      where: {
        id: sessionId,
        userId,
        isActive: true,
      },
      include: {
        messages: {
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
    });

    if (!session) {
      throw new NotFoundException('Chat session not found');
    }

    return {
      success: true,
      message: 'Chat session retrieved successfully',
      data: session,
    };
  }

  public async chatWithSession(
    sessionId: string,
    userId: string,
    prompt: string,
    options?: {
      temperature?: number;
      maxTokens?: number;
    }
  ) {
    // Verify session exists and belongs to user
    const session = await this.prisma.chatSession.findFirst({
      where: {
        id: sessionId,
        userId,
        isActive: true,
      },
    });

    if (!session) {
      throw new NotFoundException('Chat session not found');
    }

    try {
      // Save user message to database
      const userMessage = await this.prisma.chatMessage.create({
        data: {
          sessionId,
          role: 'USER',
          content: prompt.trim(),
        },
      });

      // Get chat history from database for context (last N, oldest first)
      const recentMessagesDesc = await this.prisma.chatMessage.findMany({
        where: { sessionId },
        orderBy: { createdAt: 'desc' },
        take: 10,
      });
      const chatHistory = [...recentMessagesDesc].reverse();

      // Map DB messages to Gemini history format
      const geminiHistory = chatHistory.map((m) => ({
        role: m.role === 'USER' ? 'user' : 'model',
        parts: [{ text: m.content }],
      }));

      // Create Gemini chat instance with history
      const chat = this.gemini.chats.create({
        model: session.model,
        history: geminiHistory,
      });

      // Send message to Gemini
      const response = await chat.sendMessageStream({
        message: prompt.trim(),
      });

      let fullResponse = '';
      const responseChunks: string[] = [];

      // Collect streaming response
      for await (const chunk of response) {
        if (chunk.text) {
          fullResponse += chunk.text;
          responseChunks.push(chunk.text);
        }
      }

      // Save AI response to database
      const aiMessage = await this.prisma.chatMessage.create({
        data: {
          sessionId,
          role: 'ASSISTANT',
          content: fullResponse,
        },
      });

      // Update session timestamp
      await this.prisma.chatSession.update({
        where: { id: sessionId },
        data: { updatedAt: new Date() },
      });

      // Update session title if it's the first message
      if (chatHistory.length === 1) {
        const title = prompt.length > 50 ? prompt.substring(0, 50) + '...' : prompt;
        await this.prisma.chatSession.update({
          where: { id: sessionId },
          data: { title },
        });
      }

      return {
        success: true,
        message: 'Chat response generated successfully',
        data: {
          userMessage,
          aiMessage,
          response: fullResponse,
          chunks: responseChunks,
        },
      };

    } catch (error) {
      console.error('chatWithSession error details:', {
        message: error.message,
        stack: error.stack,
        prompt: prompt,
        sessionId,
        userId,
      });
      throw error;
    }
  }

  public async deleteChatSession(sessionId: string, userId: string) {
    const session = await this.prisma.chatSession.findFirst({
      where: {
        id: sessionId,
        userId,
        isActive: true,
      },
    });

    if (!session) {
      throw new NotFoundException('Chat session not found');
    }

    await this.prisma.chatSession.update({
      where: { id: sessionId },
      data: { isActive: false },
    });

    return {
      success: true,
      message: 'Chat session deleted successfully',
    };
  }

  public async updateChatSession(
    sessionId: string,
    userId: string,
    data: {
      title?: string;
      temperature?: number;
      maxTokens?: number;
      model?: string;
    }
  ) {
    const session = await this.prisma.chatSession.findFirst({
      where: {
        id: sessionId,
        userId,
        isActive: true,
      },
    });

    if (!session) {
      throw new NotFoundException('Chat session not found');
    }

    const updatedSession = await this.prisma.chatSession.update({
      where: { id: sessionId },
      data,
    });

    return {
      success: true,
      message: 'Chat session updated successfully',
      data: updatedSession,
    };
  }
  

  public async generateQuestions (file: Express.Multer.File) {
    try {
      const pdfData = await pdfParse(file.buffer);
      
      const extractedText = pdfData.text;
      
      const response = await this.groq.chat.completions.create({
        model: "openai/gpt-oss-120b",
        messages: [
          {
            role: "system",
            content: "You are an AI interview assistant. Analyze a candidate's resume and generate interview questions in a structured JSON format. The JSON should have three keys: 'technical', 'projects', and 'behavioral'. Each key should contain an array of questions. Ensure questions are clear, relevant, and concise."
          },
          {
            role: "user",
            content: extractedText
          }
    
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "product_review",
            schema: {
              type: "object",
              properties: {
                technical: {
                  type: "array",
                  items: { type: "string" }
                },
                projects: {
                  type: "array",
                  items: { type: "string" }
                },
                behavioral: {
                  type: "array",
                  items: { type: "string" }
                }
              },
              required: ["technical", "projects", "behavioral"]
            }
          }
        }
      });
      
      const result = JSON.parse(response.choices[0].message.content || "{}");
      
      return {
        result
      };
    } catch (error) {
      console.error('Error extracting PDF text:', error);
      throw new Error('Failed to extract text from PDF');
    }
  }


  // Interview flow
  public async startInterviewFromResume(file: Express.Multer.File, userId: string) {
    // Enforce plan limits before starting
    await this.enforceInterviewLimit(userId);

    const pdfData = await pdfParse(file.buffer);
    const resumeText = pdfData.text;

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

    // Ask GROQ to generate categorized questions
    const response = await this.groq.chat.completions.create({
      model: 'openai/gpt-oss-120b',
      messages: [
        {
          role: 'system',
          content:
            'You are an AI interviewer. Based on the provided resume text, generate 12 interview questions: 5 technical, 4 projects, 3 behavioral. Return a JSON object with keys technical, projects, behavioral. Keep each question concise (max 200 characters).',
        },
        { role: 'user', content: resumeText },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'interview_questions',
          schema: {
            type: 'object',
            properties: {
              technical: { type: 'array', items: { type: 'string' } },
              projects: { type: 'array', items: { type: 'string' } },
              behavioral: { type: 'array', items: { type: 'string' } },
            },
            required: ['technical', 'projects', 'behavioral'],
          },
        },
      },
    });

    const parsed = JSON.parse(response.choices[0].message.content || '{}');
    const toCreate: Array<{ text: string; category: 'TECHNICAL' | 'PROJECTS' | 'BEHAVIORAL'; order: number }> = [];
    const pushList = (arr: string[] | undefined, cat: 'TECHNICAL' | 'PROJECTS' | 'BEHAVIORAL') => {
      if (!Array.isArray(arr)) return;
      arr.forEach((q) => {
        const nextOrder = toCreate.length;
        toCreate.push({ text: q, category: cat, order: nextOrder });
      });
    };
    pushList(parsed.technical, 'TECHNICAL');
    pushList(parsed.projects, 'PROJECTS');
    pushList(parsed.behavioral, 'BEHAVIORAL');

    if (toCreate.length === 0) {
      throw new Error('Failed to generate questions');
    }

    // Persist questions
    await this.prisma.interviewQuestion.createMany({
      data: toCreate.map((q) => ({
        sessionId: session.id,
        category: q.category,
        text: q.text,
        order: q.order,
        maxScore: 10,
      })),
    });

    await this.prisma.interviewSession.update({
      where: { id: session.id },
      data: { questionCount: toCreate.length },
    });

    const result = {
      success: true,
      message: 'Interview started',
      data: { sessionId: session.id, totalQuestions: toCreate.length },
    };
    this.gateway.emitToSession(session.id, 'interview:started', result.data);
    return result;
  }

  public async getNextQuestion(sessionId: string, userId: string) {
    const session = await this.prisma.interviewSession.findFirst({ where: { id: sessionId, userId } });
    if (!session) throw new NotFoundException('Interview session not found');
    if (session.status === 'COMPLETED') {
      return { success: true, message: 'Interview completed', data: null };
    }

    const [questions, answers] = await Promise.all([
      this.prisma.interviewQuestion.findMany({ where: { sessionId }, orderBy: { order: 'asc' } }),
      this.prisma.interviewAnswer.findMany({ where: { sessionId, userId } }),
    ]);

    const answeredIds = new Set(answers.map((a) => a.questionId));
    const next = questions.find((q) => !answeredIds.has(q.id));

    if (!next) {
      // Mark completed and compute summary
      const totals = await this.computeScore(sessionId, userId);
      await this.prisma.interviewSession.update({
        where: { id: sessionId },
        data: { status: 'COMPLETED', completedAt: new Date(), totalScore: totals.totalScore, maxScore: totals.maxScore },
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

  public async submitAnswer(sessionId: string, userId: string, body: SubmitAnswerDto) {
    const session = await this.prisma.interviewSession.findFirst({ where: { id: sessionId, userId } });
    if (!session) throw new NotFoundException('Interview session not found');
    if (session.status === 'COMPLETED') throw new UnauthorizedException('Interview already completed');

    const question = await this.prisma.interviewQuestion.findFirst({ where: { id: body.questionId, sessionId } });
    if (!question) throw new NotFoundException('Question not found');

    // Upsert answer (one per sessionId+questionId+userId)
    const answer = await this.storeAnswer(sessionId, userId, question.id, body.answerText.trim(), 'TEXT');
    const res = {
      success: true,
      message: 'Answer submitted',
      data: { answerId: answer.id },
    };
    this.gateway.emitToSession(sessionId, 'answer:submitted', { questionId: question.id, answerId: res.data.answerId });
    return res;
  }

  public async getInterviewSummary(sessionId: string, userId: string) {
    const session = await this.prisma.interviewSession.findFirst({ where: { id: sessionId, userId } });
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
        graded: !!session.gradedAt,
        gradedAt: session.gradedAt ?? null,
      },
    };
  }

  private async computeScore(sessionId: string, userId: string) {
    const [answers, questions] = await Promise.all([
      this.prisma.interviewAnswer.findMany({ where: { sessionId, userId } }),
      this.prisma.interviewQuestion.findMany({ where: { sessionId } }),
    ]);
    const totalScore = answers.reduce((sum, a) => sum + (a.score ?? 0), 0);
    const maxScore = questions.reduce((sum, q) => sum + q.maxScore, 0);
    return { totalScore, maxScore };
  }

  private async enforceInterviewLimit(userId: string) {
    const now = new Date();
    const activeSub = await this.prisma.subscription.findFirst({
      where: {
        userId,
        status: 'ACTIVE',
        OR: [
          { currentPeriodEnd: null },
          { currentPeriodEnd: { gt: now } },
        ],
      },
    });

    if (activeSub) {
      // PRO: unlimited
      if (activeSub.plan === 'PRO') return;
      // BASIC: 10 per billing period
      if (activeSub.plan === 'BASIC') {
        const periodStart = activeSub.currentPeriodStart ?? new Date(now.getFullYear(), now.getMonth(), 1);
        const periodEnd = activeSub.currentPeriodEnd ?? new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
        const used = await this.prisma.interviewSession.count({
          where: {
            userId,
            createdAt: { gte: periodStart, lte: periodEnd },
          },
        });
        const BASIC_LIMIT = 10;
        if (used >= BASIC_LIMIT) {
          throw new UnauthorizedException('Basic plan monthly limit reached (10 interviews). Upgrade to Pro for unlimited.');
        }
        return;
      }
    }

    // No subscription (FREE): limit to 2 total interview sessions
    const total = await this.prisma.interviewSession.count({ where: { userId } });
    if (total >= 2) {
      throw new UnauthorizedException('Free plan limit reached (2 interviews). Upgrade to continue.');
    }
  }

  public async transcribeAndStoreAnswer(
    sessionId: string,
    userId: string,
    questionId: string,
    audio: Express.Multer.File,
  ) {
    const session = await this.prisma.interviewSession.findFirst({ where: { id: sessionId, userId } });
    if (!session) throw new NotFoundException('Interview session not found');

    // Transcribe via Groq Whisper
    // Construct a web File from the uploaded buffer for SDK compatibility
    const uint8 = new Uint8Array(audio.buffer as any);
    const file = new File([uint8], audio.originalname || 'audio.webm', { type: audio.mimetype || 'audio/webm' });

    const transcription = await (this.groq as any).audio.transcriptions.create({
      file,
      model: 'whisper-large-v3-turbo',
      response_format: 'verbose_json',
      language: 'en',
      temperature: 0,
    });

    const text: string = transcription?.text || transcription?.results?.channels?.[0]?.alternatives?.[0]?.transcript || '';
    if (!text.trim()) {
      throw new Error('Transcription failed or returned empty text');
    }

    // Store answer without grading, include transcription metadata
    const question = await this.prisma.interviewQuestion.findFirst({ where: { id: questionId, sessionId } });
    if (!question) throw new NotFoundException('Question not found');
    const answer = await this.storeAnswer(sessionId, userId, questionId, text, 'AUDIO', transcription);
    const res = {
      success: true,
      message: 'Answer submitted',
      data: { answerId: answer.id },
    };
    this.gateway.emitToSession(sessionId, 'answer:submitted', { questionId, answerId: res.data.answerId });
    return res;
  }

  public async gradeInterview(sessionId: string, userId: string) {
    const session = await this.prisma.interviewSession.findFirst({ where: { id: sessionId, userId } });
    if (!session) throw new NotFoundException('Interview session not found');
    if (session.gradedAt) {
      return {
        success: true,
        message: 'Already graded',
        data: await this.getInterviewSummary(sessionId, userId).then((r) => r.data),
      };
    }

    const questions = await this.prisma.interviewQuestion.findMany({ where: { sessionId } });
    const answers = await this.prisma.interviewAnswer.findMany({ where: { sessionId, userId } });
    const questionById = new Map(questions.map((q) => [q.id, q] as const));

    const gradedResults: Array<{ answerId: string; questionId: string; score: number; feedback: string }> = [];
    const TIMEOUT_MARKER = '__TIMEOUT__';
    for (const answer of answers) {
      if (answer.answerText === TIMEOUT_MARKER) continue;
      const question = questionById.get(answer.questionId);
      if (!question) continue;
      const gradingPrompt = `You are an expert interviewer. Grade the candidate's answer on a scale of 0 to ${question.maxScore}.
Question: ${question.text}
Answer: ${answer.answerText}
Return strict JSON with keys: score (number), feedback (string).`;

      const grade = await this.groq.chat.completions.create({
        model: 'openai/gpt-oss-120b',
        messages: [
          { role: 'system', content: 'You are a strict grader returning only JSON.' },
          { role: 'user', content: gradingPrompt },
        ],
      });

      let feedback = 'Auto-grading failed.';
      let score = 0;
      try {
        const parsed = JSON.parse(grade.choices[0].message.content || '{}');
        feedback = parsed.feedback ?? feedback;
        score = Math.max(0, Math.min(question.maxScore, Number(parsed.score)));
      } catch {}

      const updated = await this.prisma.interviewAnswer.update({ where: { id: answer.id }, data: { aiFeedback: feedback, score, gradedAt: new Date() } });
      gradedResults.push({ answerId: updated.id, questionId: updated.questionId, score: updated.score ?? 0, feedback: updated.aiFeedback ?? '' });
    }

    // Update session totals if all questions are answered
    const allAnswered = answers.length >= questions.length && questions.length > 0;
    if (allAnswered) {
      const totals = await this.computeScore(sessionId, userId);
      await this.prisma.interviewSession.update({
        where: { id: sessionId },
        data: { status: 'COMPLETED', completedAt: new Date(), gradedAt: new Date(), totalScore: totals.totalScore, maxScore: totals.maxScore },
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

  public async timeoutAnswer(
    sessionId: string,
    userId: string,
    questionId: string,
  ) {
    const TIMEOUT_MARKER = '__TIMEOUT__';
    // Ensure question exists and belongs to session
    const question = await this.prisma.interviewQuestion.findFirst({ where: { id: questionId, sessionId } });
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
        answerText: TIMEOUT_MARKER,
        source: 'TEXT',
      },
      update: {
        answerText: TIMEOUT_MARKER,
        source: 'TEXT',
        aiFeedback: null,
        score: null,
        gradedAt: null,
      },
    });

    this.gateway.emitToSession(sessionId, 'answer:submitted', { questionId, timedOut: true });
    return { success: true };
  }

  public async getQuestionsWithStatus(sessionId: string, userId: string) {
    const session = await this.prisma.interviewSession.findFirst({ where: { id: sessionId, userId } });
    if (!session) throw new NotFoundException('Interview session not found');

    const [questions, answers] = await Promise.all([
      this.prisma.interviewQuestion.findMany({ where: { sessionId }, orderBy: { order: 'asc' } }),
      this.prisma.interviewAnswer.findMany({ where: { sessionId, userId } }),
    ]);
    const TIMEOUT_MARKER = '__TIMEOUT__';
    const answered = new Set(answers.filter((a) => a.answerText !== TIMEOUT_MARKER).map((a) => a.questionId));
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
}
