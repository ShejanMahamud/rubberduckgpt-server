import { IsNotEmpty, IsString, IsUUID, IsOptional, IsNumber, Min, Max } from 'class-validator';
import { BaseResponseDto, QuestionContextDto } from './common.dto';

export class SubmitAnswerDto {
  @IsUUID()
  questionId: string;

  @IsString()
  @IsNotEmpty()
  answerText: string;
}

export class SubmitAudioAnswerDto {
  @IsUUID()
  questionId: string;
}

export class TimeoutAnswerDto {
  @IsUUID()
  questionId: string;
}

export type InterviewCategoryType = 'TECHNICAL' | 'PROJECTS' | 'BEHAVIORAL';

export interface NextQuestionResponse {
  questionId: string;
  text: string;
  category: InterviewCategoryType;
  order: number;
  remaining: number;
}

export interface InterviewSummaryResponse {
  sessionId: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
  totalScore?: number;
  maxScore?: number;
  answered: number;
  totalQuestions: number;
}

// Enhanced DTOs
export class StartInterviewResponseDto extends BaseResponseDto<{
  sessionId: string;
  totalQuestions: number;
}> {}

export class NextQuestionResponseDto extends BaseResponseDto<NextQuestionResponse | null> {}

export class QuestionsWithStatusResponseDto extends BaseResponseDto<Array<{
  id: string;
  text: string;
  category: InterviewCategoryType;
  order: number;
  maxScore: number;
  answer?: {
    id: string;
    text: string;
    score?: number;
    feedback?: string;
    submittedAt: string;
  };
}>> {}

export class SubmitAnswerResponseDto extends BaseResponseDto<{
  answerId: string;
  questionId: string;
  score?: number;
  feedback?: string;
}> {}

export class TranscribeAudioResponseDto extends BaseResponseDto<{
  transcription: string;
  answerId: string;
}> {}

export class GradeInterviewResponseDto extends BaseResponseDto<{
  totalScore: number;
  maxScore: number;
  averageScore: number;
  feedback: string;
}> {}

export class InterviewSummaryResponseDto extends BaseResponseDto<InterviewSummaryResponse> {}

export class TimeoutAnswerResponseDto extends BaseResponseDto<{
  questionId: string;
  markedAsTimeout: boolean;
}> {}


