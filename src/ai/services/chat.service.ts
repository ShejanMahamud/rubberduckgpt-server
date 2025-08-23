import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { PROVIDER_TOKENS } from '../constants/provider-tokens';
import {
  ChatMessageDto,
  ChatSessionDto,
  ChatSessionWithCountDto,
  ChatSessionWithMessagesDto,
  ChatWithSessionResponseDto,
  CreateChatSessionDto,
  DeleteChatSessionResponseDto,
  GetChatSessionResponseDto,
  GetChatSessionsResponseDto,
  UpdateChatSessionDto,
  UpdateChatSessionResponseDto,
} from '../dto/chat.dto';
import { IChatProvider } from '../interfaces/ai-provider.interface';
import { IChatService } from '../interfaces/chat.interface';
import {
  ChatMessageWithSession,
  ChatSessionWithMessages,
} from '../types/chat.types';
import { AiConfigService } from './ai-config.service';
import { PlanLimitsService } from './plan-limits.service';

@Injectable()
export class ChatService implements IChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(PROVIDER_TOKENS.GEMINI_CHAT_PROVIDER)
    private readonly chatProvider: IChatProvider,
    private readonly planLimitsService: PlanLimitsService,
    private readonly configService: AiConfigService,
  ) {}

  private mapToChatMessageDto(message: ChatMessageWithSession): ChatMessageDto {
    return {
      id: message.id,
      role: message.role,
      content: message.content,
      createdAt: message.createdAt.toISOString(),
      sessionId: message.sessionId,
      tokens: message.tokens ?? undefined,
    };
  }

  private mapToChatSessionDto(
    session: ChatSessionWithMessages,
  ): ChatSessionDto {
    return {
      id: session.id,
      userId: session.userId,
      title: session.title ?? null,
      temperature: session.temperature ?? null,
      maxTokens: session.maxTokens ?? null,
      model: session.model,
      isActive: session.isActive,
      createdAt: session.createdAt.toISOString(),
      updatedAt: session.updatedAt.toISOString(),
    };
  }

  private mapToChatSessionWithMessagesDto(
    session: ChatSessionWithMessages,
  ): ChatSessionWithMessagesDto {
    return {
      ...this.mapToChatSessionDto(session),
      messages:
        session.messages?.map((msg) => this.mapToChatMessageDto(msg)) || [],
    };
  }

  private mapToChatSessionWithCountDto(
    session: ChatSessionWithMessages,
  ): ChatSessionWithCountDto {
    return {
      ...this.mapToChatSessionDto(session),
      _count: session._count || { messages: 0 },
    };
  }

  public async getOrCreateChatSession(
    userId: string,
    prompt: string,
    sessionId?: string,
    options?: CreateChatSessionDto,
  ): Promise<ChatSessionWithMessages> {
    // Enforce chat limits before creating/fetching session
    await this.planLimitsService.enforceChatLimit(userId);

    // Try to fetch existing session if sessionId is provided
    if (sessionId) {
      const existingSession = await this.prisma.chatSession.findFirst({
        where: { id: sessionId, userId, isActive: true },
        include: { messages: true },
      });

      if (existingSession) return existingSession;
    }

    // No session found or sessionId not provided -> create a new one
    const newSession = await this.prisma.chatSession.create({
      data: {
        userId,
        temperature: options?.temperature ?? 0.7, // default
        maxTokens: options?.maxTokens ?? 512, // default
        title: options?.title?.trim() || prompt.slice(0, 50),
      },
      include: { messages: true }, // include messages immediately
    });

    return newSession;
  }

  async getChatSessions(userId: string): Promise<GetChatSessionsResponseDto> {
    this.logger.log(`Fetching chat sessions for user ${userId}`);

    try {
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
          createdAt: 'desc',
        },
      });

      this.logger.log(
        `Retrieved ${sessions.length} chat sessions for user ${userId}`,
      );

      return {
        success: true,
        message: 'Chat sessions retrieved successfully',
        data: sessions.map((session) =>
          this.mapToChatSessionWithCountDto(session),
        ),
      };
    } catch (error) {
      this.logger.error(`Failed to fetch chat sessions for user ${userId}`, {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async getChatSession(
    sessionId: string,
    userId: string,
  ): Promise<GetChatSessionResponseDto> {
    this.logger.log(`Fetching chat session ${sessionId} for user ${userId}`);

    try {
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
        this.logger.warn(
          `Chat session ${sessionId} not found for user ${userId}`,
        );
        throw new NotFoundException('Chat session not found');
      }

      this.logger.log(
        `Chat session ${sessionId} retrieved successfully for user ${userId}`,
      );

      return {
        success: true,
        message: 'Chat session retrieved successfully',
        data: this.mapToChatSessionWithMessagesDto(session),
      };
    } catch (error) {
      this.logger.error(
        `Failed to fetch chat session ${sessionId} for user ${userId}`,
        { error: error instanceof Error ? error.message : String(error) },
      );
      throw error;
    }
  }

  async chatWithSession(
    userId: string,
    prompt: string,
    sessionId?: string,
    options?: CreateChatSessionDto,
  ): Promise<ChatWithSessionResponseDto> {
    try {
      const session = await this.getOrCreateChatSession(
        userId,
        prompt,
        sessionId,
        options,
      );
      // Validate input
      if (!prompt.trim()) {
        throw new BadRequestException('Message cannot be empty');
      }

      if (!session) {
        throw new Error('Failed to create or retrieve session');
      }

      // Create user message
      const userMessage = await this.prisma.chatMessage.create({
        data: {
          sessionId: session.id,
          role: 'USER',
          content: prompt.trim(),
        },
      });

      // Prepare conversation history for AI
      const providerHistory = (session.messages || []).map((msg) => ({
        role: msg.role === 'USER' ? ('user' as const) : ('model' as const),
        parts: [{ text: msg.content }],
      }));

      // Get AI response
      const aiResponse = await this.chatProvider.sendMessage(
        providerHistory,
        prompt,
        session.model,
      );

      // Create AI message
      const aiMessage = await this.prisma.chatMessage.create({
        data: {
          sessionId: session.id,
          role: 'ASSISTANT',
          content: aiResponse.text,
        },
      });

      this.logger.log(
        `Chat message processed successfully in session ${session.id}`,
        {
          userId,
          responseLength: aiResponse.text.length,
        },
      );

      return {
        success: true,
        message: 'Message sent successfully',
        data: {
          userMessage: this.mapToChatMessageDto(userMessage),
          aiMessage: this.mapToChatMessageDto(aiMessage),
          response: aiResponse.text,
          chunks: aiResponse.chunks,
        },
      };
    } catch (error) {
      this.logger.error(
        `Failed to process chat message in session ${sessionId} for user ${userId}`,
        {
          error: error instanceof Error ? error.message : String(error),
          promptLength: prompt.length,
        },
      );

      throw error;
    }
  }

  async deleteChatSession(
    sessionId: string,
    userId: string,
  ): Promise<DeleteChatSessionResponseDto> {
    this.logger.log(`Deleting chat session ${sessionId} for user ${userId}`);

    try {
      const session = await this.prisma.chatSession.findFirst({
        where: { id: sessionId, userId, isActive: true },
      });

      if (!session) {
        throw new NotFoundException('Chat session not found');
      }

      await this.prisma.chatSession.update({
        where: { id: sessionId },
        data: { isActive: false },
      });

      this.logger.log(
        `Chat session ${sessionId} deleted successfully for user ${userId}`,
      );

      return {
        success: true,
        message: 'Chat session deleted successfully',
        data: null,
      };
    } catch (error) {
      this.logger.error(
        `Failed to delete chat session ${sessionId} for user ${userId}`,
        { error: error instanceof Error ? error.message : String(error) },
      );
      throw error;
    }
  }

  async updateChatSession(
    sessionId: string,
    userId: string,
    data: UpdateChatSessionDto,
  ): Promise<UpdateChatSessionResponseDto> {
    this.logger.log(`Updating chat session ${sessionId} for user ${userId}`, {
      updateData: data,
    });

    try {
      const session = await this.prisma.chatSession.findUnique({
        where: { id: sessionId, userId, isActive: true },
      });

      if (!session) {
        throw new NotFoundException('Chat session not found');
      }

      // Validate model if provided
      if (
        data.model &&
        !this.configService.validateModel('gemini', data.model)
      ) {
        throw new BadRequestException(`Unsupported model: ${data.model}`);
      }

      const updatedSession = await this.prisma.chatSession.update({
        where: { id: sessionId },
        data: {
          ...(data.title && { title: data.title }),
          ...(data.temperature && {
            temperature: data.temperature,
          }),
          ...(data.maxTokens && { maxTokens: data.maxTokens }),
          ...(data.model && { model: data.model }),
        },
      });

      this.logger.log(
        `Chat session ${sessionId} updated successfully for user ${userId}`,
      );

      return {
        success: true,
        message: 'Chat session updated successfully',
        data: this.mapToChatSessionDto(updatedSession),
      };
    } catch (error) {
      this.logger.error(
        `Failed to update chat session ${sessionId} for user ${userId}`,
        {
          error: error instanceof Error ? error.message : String(error),
          updateData: data,
        },
      );
      throw error;
    }
  }
}
