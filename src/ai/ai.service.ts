import { Injectable } from '@nestjs/common';
import { ChatService } from './services/chat.service';
import { InterviewService } from './services/interview.service';
import { PlanLimitsService } from './services/plan-limits.service';

@Injectable()
export class AiService {
  constructor(
    private readonly chatService: ChatService,
    private readonly interviewService: InterviewService,
    private readonly planLimitsService: PlanLimitsService,
  ) {}

  // Chat operations - delegate to ChatService
  public async createChatSession(userId: string, options?: {
    title?: string;
    temperature?: number;
    maxTokens?: number;
    model?: string;
  }) {
    return this.chatService.createChatSession(userId, options);
  }

  public async getChatSessions(userId: string) {
    return this.chatService.getChatSessions(userId);
  }

  public async getChatSession(sessionId: string, userId: string) {
    return this.chatService.getChatSession(sessionId, userId);
  }

  public async chatWithSession(
    sessionId: string,
    userId: string,
    prompt: string,
    options?: { temperature?: number; maxTokens?: number; }
  ) {
    return this.chatService.chatWithSession(sessionId, userId, prompt, options);
  }

  public async deleteChatSession(sessionId: string, userId: string) {
    return this.chatService.deleteChatSession(sessionId, userId);
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
    return this.chatService.updateChatSession(sessionId, userId, data);
  }

  // Interview operations - delegate to InterviewService
  public async startInterviewFromResume(file: Express.Multer.File, userId: string) {
    return this.interviewService.startInterviewFromResume(file, userId);
  }

  public async getNextQuestion(sessionId: string, userId: string) {
    return this.interviewService.getNextQuestion(sessionId, userId);
  }

  public async submitAnswer(sessionId: string, userId: string, body: any) {
    return this.interviewService.submitAnswer(sessionId, userId, body);
  }

  public async getInterviewSummary(sessionId: string, userId: string) {
    return this.interviewService.getInterviewSummary(sessionId, userId);
  }

  public async transcribeAndStoreAnswer(
    sessionId: string,
    userId: string,
    questionId: string,
    audio: Express.Multer.File,
  ) {
    return this.interviewService.transcribeAndStoreAnswer(sessionId, userId, questionId, audio);
  }

  public async gradeInterview(sessionId: string, userId: string) {
    return this.interviewService.gradeInterview(sessionId, userId);
  }

  public async timeoutAnswer(
    sessionId: string,
    userId: string,
    questionId: string,
  ) {
    return this.interviewService.timeoutAnswer(sessionId, userId, questionId);
  }

  public async getQuestionsWithStatus(sessionId: string, userId: string) {
    return this.interviewService.getQuestionsWithStatus(sessionId, userId);
  }

  // Plan limit operations - delegate to PlanLimitsService
  public async enforceInterviewLimit(userId: string) {
    return this.planLimitsService.enforceInterviewLimit(userId);
  }

  public async enforceChatLimit(userId: string) {
    return this.planLimitsService.enforceChatLimit(userId);
  }

  public async enforceResumeUploadLimit(userId: string) {
    return this.planLimitsService.enforceResumeUploadLimit(userId);
  }

  // Analysis operations - delegate to InterviewService
  public async generateQuestions(file: Express.Multer.File) {
    return this.interviewService.generateQuestionsFromResume(file);
  }
}
