import { Inject, Injectable } from '@nestjs/common';
import Groq from 'groq-sdk';
import { IAiProvider } from '../interfaces/ai-provider.interface';
import { AiConfigService } from '../services/ai-config.service';
import { BaseAiProvider } from './base-ai.provider';

@Injectable()
export class GroqAiProvider extends BaseAiProvider implements IAiProvider {
  constructor(
    @Inject('GROQ') private readonly groq: Groq,
    private readonly configService: AiConfigService,
  ) {
    super({ maxRetries: 3, retryDelay: 1000, timeout: 30000 });
  }

  async generateQuestions(text: string): Promise<
    Array<{
      text: string;
      category: 'TECHNICAL' | 'PROJECTS' | 'BEHAVIORAL';
      order: number;
    }>
  > {
    const operationName = 'generateQuestions';
    const context = { textLength: text.length, provider: 'groq' };

    this.logOperation(operationName, context);

    try {
      const result = await this.withRetry(
        () => this.generateQuestionsInternal(text),
        operationName,
        context,
      );

      this.logSuccess(operationName, {
        ...context,
        questionCount: result.length,
      });
      return result;
    } catch (error) {
      this.logError(operationName, error as Error, context);
      throw new Error(`Failed to generate questions: ${error.message}`);
    }
  }

  async gradeAnswer(
    question: string,
    answer: string,
    maxScore: number,
  ): Promise<{
    score: number;
    feedback: string;
  }> {
    const operationName = 'gradeAnswer';
    const context = {
      questionLength: question.length,
      answerLength: answer.length,
      maxScore,
      provider: 'groq',
    };

    this.logOperation(operationName, context);

    try {
      const result = await this.withRetry(
        () => this.gradeAnswerInternal(question, answer, maxScore),
        operationName,
        context,
      );

      this.logSuccess(operationName, { ...context, score: result.score });
      return result;
    } catch (error) {
      this.logError(operationName, error as Error, context);
      throw new Error(`Failed to grade answer: ${error.message}`);
    }
  }

  async transcribeAudio(audio: Express.Multer.File): Promise<string> {
    const operationName = 'transcribeAudio';
    const context = {
      fileSize: audio.size,
      mimeType: audio.mimetype,
      provider: 'groq',
    };

    this.logOperation(operationName, context);

    try {
      const result = await this.withRetry(
        () => this.transcribeAudioInternal(audio),
        operationName,
        context,
      );

      this.logSuccess(operationName, {
        ...context,
        transcriptionLength: result.length,
      });
      return result;
    } catch (error) {
      this.logError(operationName, error as Error, context);
      throw new Error(`Failed to transcribe audio: ${error.message}`);
    }
  }

  private async generateQuestionsInternal(text: string): Promise<
    Array<{
      text: string;
      category: 'TECHNICAL' | 'PROJECTS' | 'BEHAVIORAL';
      order: number;
    }>
  > {
    const model = this.configService.getDefaultModel('groq');

    const response = await this.groq.chat.completions.create({
      model,
      messages: [
        {
          role: 'system',
          content:
            'You are an AI interviewer. Based on the provided resume text, generate 15 interview questions: 5 technical, 5 projects, 5 behavioral. Return a JSON object with keys technical, projects, behavioral. Keep each question concise (max 200 characters).',
        },
        {
          role: 'user',
          content: text,
        },
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
    const toCreate: Array<{
      text: string;
      category: 'TECHNICAL' | 'PROJECTS' | 'BEHAVIORAL';
      order: number;
    }> = [];

    const pushList = (
      arr: string[] | undefined,
      cat: 'TECHNICAL' | 'PROJECTS' | 'BEHAVIORAL',
    ) => {
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
      throw new Error(
        'Failed to generate questions - no questions were created',
      );
    }

    return toCreate;
  }

  private async gradeAnswerInternal(
    question: string,
    answer: string,
    maxScore: number,
  ): Promise<{
    score: number;
    feedback: string;
  }> {
    const model = this.configService.getDefaultModel('groq');

    const gradingPrompt = `You are an expert interviewer. Grade the candidate's answer on a scale of 0 to ${maxScore}.
Question: ${question}
Answer: ${answer}
Return strict JSON with keys: score (number), feedback (string).`;

    const grade = await this.groq.chat.completions.create({
      model,
      messages: [
        {
          role: 'system',
          content: 'You are a strict grader returning only JSON.',
        },
        { role: 'user', content: gradingPrompt },
      ],
    });

    let feedback = 'Auto-grading failed.';
    let score = 0;

    try {
      const parsed = JSON.parse(grade.choices[0].message.content || '{}');
      feedback = parsed.feedback ?? feedback;
      score = Math.max(0, Math.min(maxScore, Number(parsed.score)));
    } catch {
      // Use default values if parsing fails
    }

    return { score, feedback };
  }

  private async transcribeAudioInternal(
    audio: Express.Multer.File,
  ): Promise<string> {
    const model = this.configService.getDefaultModel('groq');

    const response = await this.groq.audio.transcriptions.create({
      file: audio.buffer as any,
      model: 'whisper-large-v3',
    });

    return response.text;
  }
}
