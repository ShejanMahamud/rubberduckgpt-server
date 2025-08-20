import { IsNotEmpty, IsString } from 'class-validator';

export class SubmitAnswerDto {
  @IsString()
  @IsNotEmpty()
  questionId: string;

  @IsString()
  @IsNotEmpty()
  answerText: string;
}

export class SubmitAudioAnswerDto {
  @IsString()
  @IsNotEmpty()
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


