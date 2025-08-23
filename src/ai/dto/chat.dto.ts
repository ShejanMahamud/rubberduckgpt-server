// chat.dto.ts
import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { BaseResponseDto } from './common.dto';

export class CreateChatSessionDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(2)
  temperature?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(8192)
  maxTokens?: number;

  @IsOptional()
  @IsString()
  model?: string;
}

export class SendChatMessageDto {
  @IsOptional()
  @IsString()
  sessionId?: string;

  @IsString()
  @IsNotEmpty()
  message: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(2)
  temperature?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(8192)
  maxTokens?: number;
}

export class UpdateChatSessionDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(2)
  temperature?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(8192)
  maxTokens?: number;

  @IsOptional()
  @IsString()
  model?: string;
}

export class ChatMessageDto {
  @IsUUID()
  id: string;

  @IsString()
  role: 'USER' | 'ASSISTANT';

  @IsString()
  content: string;

  @IsString()
  createdAt: string;

  @IsUUID()
  sessionId: string;

  @IsOptional()
  @IsNumber()
  tokens?: number | null;
}

export class ChatSessionDto {
  @IsUUID()
  id: string;

  @IsString()
  userId: string;

  @IsOptional()
  @IsString()
  title: string | null;

  @IsOptional()
  @IsNumber()
  temperature: number | null;

  @IsOptional()
  @IsNumber()
  maxTokens: number | null;

  @IsString()
  model: string;

  isActive: boolean;

  @IsString()
  createdAt: string;

  @IsString()
  updatedAt: string;
}

export class ChatSessionWithMessagesDto extends ChatSessionDto {
  messages: ChatMessageDto[];
}

export class ChatSessionWithCountDto extends ChatSessionDto {
  _count: {
    messages: number;
  };
}

// Response DTOs
export class CreateChatSessionResponseDto extends BaseResponseDto<ChatSessionWithMessagesDto> {}
export class GetChatSessionsResponseDto extends BaseResponseDto<
  ChatSessionWithCountDto[]
> {}
export class GetChatSessionResponseDto extends BaseResponseDto<ChatSessionWithMessagesDto> {}
export class ChatWithSessionResponseDto extends BaseResponseDto<{
  userMessage: ChatMessageDto;
  aiMessage: ChatMessageDto;
  response: string;
  chunks: string[];
}> {}
export class UpdateChatSessionResponseDto extends BaseResponseDto<ChatSessionDto> {}
export class DeleteChatSessionResponseDto extends BaseResponseDto<null> {}
