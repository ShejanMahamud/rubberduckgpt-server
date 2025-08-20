import { Body, Controller, Delete, FileTypeValidator, Get, MaxFileSizeValidator, Param, ParseFilePipe, Patch, Post, Req, UnauthorizedException, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Request } from 'express';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { IJwtPayload } from 'src/auth/types';
import { AiService } from './ai.service';
import { CreateChatSessionDto, SendChatMessageDto } from './dto/chat.dto';
import { SubmitAnswerDto, SubmitAudioAnswerDto } from './dto/interview.dto';

@Controller('ai')
@UseGuards(JwtAuthGuard)
export class AiController {
  constructor(private readonly aiService: AiService) {}

  private getUserId(req: Request): string {
    const user = req.user as IJwtPayload;
    if (!user || !user.sub) {
      throw new UnauthorizedException('User not authenticated');
    }
    return user.sub;
  }

  @Post('chat-sessions')
  async createChatSession(
    @Body() createSessionDto: CreateChatSessionDto,
    @Req() req: Request
  ): Promise<any> {
    const userId = this.getUserId(req);
    return this.aiService.createChatSession(userId, createSessionDto);
  }

  @Get('chat-sessions')
  async getChatSessions(@Req() req: Request): Promise<any> {
    const userId = this.getUserId(req);
    return this.aiService.getChatSessions(userId);
  }

  @Get('chat-sessions/:sessionId')
  async getChatSession(
    @Param('sessionId') sessionId: string,
    @Req() req: Request
  ): Promise<any> {
    const userId = this.getUserId(req);
    return this.aiService.getChatSession(sessionId, userId);
  }

  @Post('chat-sessions/:sessionId/chat')
  async chatWithSession(
    @Param('sessionId') sessionId: string,
    @Body() body: SendChatMessageDto,
    @Req() req: Request
  ): Promise<any> {
    const userId = this.getUserId(req);
    return this.aiService.chatWithSession(
      sessionId,
      userId,
      body.message
    );
  }

  @Post('analyze')
  @UseInterceptors(FileInterceptor('file'))
  async search(
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 10 * 1024 * 1024 }), // 10MB in bytes
          new FileTypeValidator({ fileType: 'application/pdf' }),
        ],
      }),
    ) file: Express.Multer.File
  ) {
    return this.aiService.generateQuestions(file);
  }

  // Interview endpoints
  @Post('interviews')
  @UseInterceptors(FileInterceptor('file'))
  async startInterview(
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 10 * 1024 * 1024 }),
          new FileTypeValidator({ fileType: 'application/pdf' }),
        ],
      }),
    ) file: Express.Multer.File,
    @Req() req: Request
  ) {
    const userId = this.getUserId(req);
    return this.aiService.startInterviewFromResume(file, userId);
  }

  @Get('interviews/:sessionId/next-question')
  async getNextQuestion(
    @Param('sessionId') sessionId: string,
    @Req() req: Request
  ) {
    const userId = this.getUserId(req);
    return this.aiService.getNextQuestion(sessionId, userId);
  }

  @Get('interviews/:sessionId/questions')
  async getQuestionsWithStatus(
    @Param('sessionId') sessionId: string,
    @Req() req: Request
  ) {
    const userId = this.getUserId(req);
    return this.aiService.getQuestionsWithStatus(sessionId, userId);
  }

  @Post('interviews/:sessionId/submit')
  async submitAnswer(
    @Param('sessionId') sessionId: string,
    @Body() body: SubmitAnswerDto,
    @Req() req: Request
  ) {
    const userId = this.getUserId(req);
    return this.aiService.submitAnswer(sessionId, userId, body);
  }

  @Post('interviews/:sessionId/timeout')
  async timeoutAnswer(
    @Param('sessionId') sessionId: string,
    @Body() body: { questionId: string },
    @Req() req: Request
  ) {
    const userId = this.getUserId(req);
    return this.aiService.timeoutAnswer(sessionId, userId, body.questionId);
  }

  @Get('interviews/:sessionId/summary')
  async getSummary(
    @Param('sessionId') sessionId: string,
    @Req() req: Request
  ) {
    const userId = this.getUserId(req);
    return this.aiService.getInterviewSummary(sessionId, userId);
  }

  @Post('interviews/:sessionId/submit-audio')
  @UseInterceptors(FileInterceptor('audio'))
  async submitAudioAnswer(
    @Param('sessionId') sessionId: string,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 20 * 1024 * 1024 }),
          new FileTypeValidator({ fileType: /(audio\/\w+|video\/\w+)/ }),
        ],
      }),
    ) audio: Express.Multer.File,
    @Body() body: SubmitAudioAnswerDto,
    @Req() req: Request
  ) {
    const userId = this.getUserId(req);
    return this.aiService.transcribeAndStoreAnswer(sessionId, userId, body.questionId, audio);
  }

  @Post('interviews/:sessionId/grade')
  async gradeInterview(
    @Param('sessionId') sessionId: string,
    @Req() req: Request
  ) {
    const userId = this.getUserId(req);
    return this.aiService.gradeInterview(sessionId, userId);
  }

  @Patch('chat-sessions/:sessionId')
  async updateChatSession(
    @Param('sessionId') sessionId: string,
    @Body() updateData: Partial<CreateChatSessionDto>,
    @Req() req: Request
  ): Promise<any> {
    const userId = this.getUserId(req);
    return this.aiService.updateChatSession(sessionId, userId, updateData);
  }

  @Delete('chat-sessions/:sessionId')
  async deleteChatSession(
    @Param('sessionId') sessionId: string,
    @Req() req: Request
  ): Promise<any> {
    const userId = this.getUserId(req);
    return this.aiService.deleteChatSession(sessionId, userId);
  }

  // Legacy endpoint for backward compatibility
  @Post('chat')
  public async chat(
    @Body() body: { prompt: string },
    @Req() req: Request
  ): Promise<any> {
    const userId = this.getUserId(req);
    const session = await this.aiService.createChatSession(userId);
    return this.aiService.chatWithSession(
      session.data.id,
      userId,
      body.prompt
    );
  }
}
