import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "src/prisma/prisma.service";
import { PROVIDER_TOKENS } from "../constants/provider-tokens";
import {
  ChatMessageDto,
  ChatSessionDto,
  ChatSessionWithCountDto,
  ChatSessionWithMessagesDto,
  ChatWithSessionResponseDto,
  CreateChatSessionDto,
  CreateChatSessionResponseDto,
  DeleteChatSessionResponseDto,
  GetChatSessionResponseDto,
  GetChatSessionsResponseDto,
  UpdateChatSessionDto,
  UpdateChatSessionResponseDto,
} from "../dto/chat.dto";
import { IChatProvider } from "../interfaces/ai-provider.interface";
import { IChatService } from "../interfaces/chat.interface";
import { AiConfigService } from "./ai-config.service";
import { PlanLimitsService } from "./plan-limits.service";

@Injectable()
export class ChatService implements IChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(PROVIDER_TOKENS.GEMINI_CHAT_PROVIDER)
    private readonly chatProvider: IChatProvider,
    private readonly planLimitsService: PlanLimitsService,
    private readonly configService: AiConfigService
  ) {}

  private mapToChatMessageDto(message: any): ChatMessageDto {
    return {
      id: message.id,
      role: message.role,
      content: message.content,
      createdAt: message.createdAt.toISOString(),
      sessionId: message.sessionId,
      tokens: message.tokens,
    };
  }

  private mapToChatSessionDto(session: any): ChatSessionDto {
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
    session: any
  ): ChatSessionWithMessagesDto {
    return {
      ...this.mapToChatSessionDto(session),
      messages: session.messages?.map(this.mapToChatMessageDto) || [],
    };
  }

  private mapToChatSessionWithCountDto(session: any): ChatSessionWithCountDto {
    return {
      ...this.mapToChatSessionDto(session),
      _count: session._count || { messages: 0 },
    };
  }

  async createChatSession(
    userId: string,
    options?: CreateChatSessionDto
  ): Promise<CreateChatSessionResponseDto> {
    this.logger.log(`Creating chat session for user ${userId}`, { options });

    try {
      // Enforce chat limits before creating session
      await this.planLimitsService.enforceChatLimit(userId);

      const session = await this.prisma.chatSession.create({
        data: {
          userId,
          title: options?.title || "New Chat",
          temperature: options?.temperature ?? 0.7,
          maxTokens: options?.maxTokens ?? 4096,
          model: options?.model || this.configService.getDefaultModel("gemini"),
        },
        include: {
          messages: true,
        },
      });

      this.logger.log(`Chat session created successfully`, {
        sessionId: session.id,
        userId,
      });

      return {
        success: true,
        message: "Chat session created successfully",
        data: this.mapToChatSessionWithMessagesDto(session),
      };
    } catch (error) {
      this.logger.error(`Failed to create chat session for user ${userId}`, {
        error: error.message,
        options,
      });
      throw error;
    }
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
              createdAt: "asc",
            },
          },
          _count: {
            select: {
              messages: true,
            },
          },
        },
        orderBy: {
          updatedAt: "desc",
        },
      });

      this.logger.log(
        `Retrieved ${sessions.length} chat sessions for user ${userId}`
      );

      return {
        success: true,
        message: "Chat sessions retrieved successfully",
        data: sessions.map((session) =>
          this.mapToChatSessionWithCountDto(session)
        ),
      };
    } catch (error) {
      this.logger.error(`Failed to fetch chat sessions for user ${userId}`, {
        error: error.message,
      });
      throw error;
    }
  }

  async getChatSession(
    sessionId: string,
    userId: string
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
              createdAt: "asc",
            },
          },
        },
      });

      if (!session) {
        this.logger.warn(
          `Chat session ${sessionId} not found for user ${userId}`
        );
        throw new NotFoundException("Chat session not found");
      }

      this.logger.log(
        `Chat session ${sessionId} retrieved successfully for user ${userId}`
      );

      return {
        success: true,
        message: "Chat session retrieved successfully",
        data: this.mapToChatSessionWithMessagesDto(session),
      };
    } catch (error) {
      this.logger.error(
        `Failed to fetch chat session ${sessionId} for user ${userId}`,
        { error: error.message }
      );
      throw error;
    }
  }

  async chatWithSession(
    sessionId: string,
    userId: string,
    prompt: string,
    options?: { temperature?: number; maxTokens?: number }
  ): Promise<ChatWithSessionResponseDto> {
    this.logger.log(
      `Processing chat message in session ${sessionId} for user ${userId}`,
      { promptLength: prompt.length, options }
    );

    try {
      // Enforce chat limits before sending message
      await this.planLimitsService.enforceChatLimit(userId);

      // Get session and validate ownership
      const session = await this.prisma.chatSession.findFirst({
        where: { id: sessionId, userId, isActive: true },
        include: { messages: true },
      });

      if (!session) {
        throw new NotFoundException("Chat session not found");
      }

      // Validate input
      if (!prompt.trim()) {
        throw new BadRequestException("Message cannot be empty");
      }

      // Create user message
      const userMessage = await this.prisma.chatMessage.create({
        data: {
          sessionId,
          role: "USER",
          content: prompt.trim(),
        },
      });

      // Prepare conversation history for AI
      const providerHistory = session.messages.map((msg) => ({
        role: msg.role === "USER" ? ("user" as const) : ("model" as const),
        parts: [{ text: msg.content }],
      }));

      // Get AI response
      const aiResponse = await this.chatProvider.sendMessage(
        providerHistory,
        prompt,
        session.model
      );

      // Create AI message
      const aiMessage = await this.prisma.chatMessage.create({
        data: {
          sessionId,
          role: "ASSISTANT",
          content: aiResponse.text,
        },
      });

      // Update session timestamp
      await this.prisma.chatSession.update({
        where: { id: sessionId },
        data: { updatedAt: new Date() },
      });

      this.logger.log(
        `Chat message processed successfully in session ${sessionId}`,
        {
          userId,
          responseLength: aiResponse.text.length,
        }
      );

      return {
        success: true,
        message: "Message sent successfully",
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
          error: error.message,
          promptLength: prompt.length,
        }
      );
      throw error;
    }
  }

  async deleteChatSession(
    sessionId: string,
    userId: string
  ): Promise<DeleteChatSessionResponseDto> {
    this.logger.log(`Deleting chat session ${sessionId} for user ${userId}`);

    try {
      const session = await this.prisma.chatSession.findFirst({
        where: { id: sessionId, userId, isActive: true },
      });

      if (!session) {
        throw new NotFoundException("Chat session not found");
      }

      await this.prisma.chatSession.update({
        where: { id: sessionId },
        data: { isActive: false },
      });

      this.logger.log(
        `Chat session ${sessionId} deleted successfully for user ${userId}`
      );

      return {
        success: true,
        message: "Chat session deleted successfully",
        data: null,
      };
    } catch (error) {
      this.logger.error(
        `Failed to delete chat session ${sessionId} for user ${userId}`,
        { error: error.message }
      );
      throw error;
    }
  }

  async updateChatSession(
    sessionId: string,
    userId: string,
    data: UpdateChatSessionDto
  ): Promise<UpdateChatSessionResponseDto> {
    this.logger.log(`Updating chat session ${sessionId} for user ${userId}`, {
      updateData: data,
    });

    try {
      const session = await this.prisma.chatSession.findFirst({
        where: { id: sessionId, userId, isActive: true },
      });

      if (!session) {
        throw new NotFoundException("Chat session not found");
      }

      // Validate model if provided
      if (
        data.model &&
        !this.configService.validateModel("gemini", data.model)
      ) {
        throw new BadRequestException(`Unsupported model: ${data.model}`);
      }

      const updatedSession = await this.prisma.chatSession.update({
        where: { id: sessionId },
        data: {
          ...(data.title !== undefined && { title: data.title }),
          ...(data.temperature !== undefined && {
            temperature: data.temperature,
          }),
          ...(data.maxTokens !== undefined && { maxTokens: data.maxTokens }),
          ...(data.model !== undefined && { model: data.model }),
          updatedAt: new Date(),
        },
      });

      this.logger.log(
        `Chat session ${sessionId} updated successfully for user ${userId}`
      );

      return {
        success: true,
        message: "Chat session updated successfully",
        data: this.mapToChatSessionDto(updatedSession),
      };
    } catch (error) {
      this.logger.error(
        `Failed to update chat session ${sessionId} for user ${userId}`,
        {
          error: error.message,
          updateData: data,
        }
      );
      throw error;
    }
  }
}
