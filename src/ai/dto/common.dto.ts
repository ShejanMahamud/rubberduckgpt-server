import { IsOptional, IsString, IsUUID } from 'class-validator';

export class BaseResponseDto<T = any> {
  success: boolean;
  message: string;
  data: T;
}

export class PaginationDto {
  @IsOptional()
  @IsString()
  page?: string;

  @IsOptional()
  @IsString()
  limit?: string;
}

export class UserContextDto {
  @IsUUID()
  userId: string;
}

export class SessionContextDto extends UserContextDto {
  @IsUUID()
  sessionId: string;
}

export class QuestionContextDto extends SessionContextDto {
  @IsUUID()
  questionId: string;
}
