// chat.dto.ts
import { IsNotEmpty, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class CreateChatSessionDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(2)
  temperature?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(8192)
  maxOutputTokens?: number;
}

export class SendChatMessageDto {
  @IsString()
  @IsNotEmpty()
  message: string;
}

export class ChatMessageResponse {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export class ChatSessionResponse {
  sessionId: string;
  createdAt: Date;
  messageCount: number;
  title?: string;
}