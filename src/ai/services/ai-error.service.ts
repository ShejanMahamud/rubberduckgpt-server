import {
  Injectable,
  Logger,
  BadRequestException,
  InternalServerErrorException,
  ServiceUnavailableException,
} from '@nestjs/common';

export enum AiErrorType {
  INVALID_INPUT = 'INVALID_INPUT',
  AI_PROVIDER_ERROR = 'AI_PROVIDER_ERROR',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  MODEL_NOT_SUPPORTED = 'MODEL_NOT_SUPPORTED',
  TRANSCRIPTION_FAILED = 'TRANSCRIPTION_FAILED',
  GENERATION_FAILED = 'GENERATION_FAILED',
  GRADING_FAILED = 'GRADING_FAILED',
  TIMEOUT = 'TIMEOUT',
  UNKNOWN = 'UNKNOWN',
}

export interface AiErrorContext {
  operation: string;
  userId?: string;
  sessionId?: string;
  provider?: string;
  model?: string;
  inputLength?: number;
  [key: string]: any;
}

@Injectable()
export class AiErrorService {
  private readonly logger = new Logger(AiErrorService.name);

  handleError(
    error: Error,
    errorType: AiErrorType,
    context: AiErrorContext,
  ): never {
    this.logger.error(`AI Error [${errorType}]: ${error.message}`, {
      errorType,
      context,
      originalError: error.message,
      stack: error.stack,
    });

    switch (errorType) {
      case AiErrorType.INVALID_INPUT:
        throw new BadRequestException(
          this.getUserFriendlyMessage(errorType, context),
        );

      case AiErrorType.AI_PROVIDER_ERROR:
      case AiErrorType.TRANSCRIPTION_FAILED:
      case AiErrorType.GENERATION_FAILED:
      case AiErrorType.GRADING_FAILED:
        throw new ServiceUnavailableException(
          this.getUserFriendlyMessage(errorType, context),
        );

      case AiErrorType.RATE_LIMIT_EXCEEDED:
        throw new BadRequestException(
          this.getUserFriendlyMessage(errorType, context),
        );

      case AiErrorType.MODEL_NOT_SUPPORTED:
        throw new BadRequestException(
          this.getUserFriendlyMessage(errorType, context),
        );

      case AiErrorType.TIMEOUT:
        throw new ServiceUnavailableException(
          this.getUserFriendlyMessage(errorType, context),
        );

      default:
        throw new InternalServerErrorException(
          this.getUserFriendlyMessage(errorType, context),
        );
    }
  }

  private getUserFriendlyMessage(
    errorType: AiErrorType,
    context: AiErrorContext,
  ): string {
    const baseMessages = {
      [AiErrorType.INVALID_INPUT]:
        'Invalid input provided. Please check your request and try again.',
      [AiErrorType.AI_PROVIDER_ERROR]:
        'AI service temporarily unavailable. Please try again later.',
      [AiErrorType.RATE_LIMIT_EXCEEDED]:
        'Rate limit exceeded. Please wait before making another request.',
      [AiErrorType.MODEL_NOT_SUPPORTED]:
        'The requested AI model is not supported.',
      [AiErrorType.TRANSCRIPTION_FAILED]:
        'Audio transcription failed. Please try again with a different audio file.',
      [AiErrorType.GENERATION_FAILED]:
        'Failed to generate content. Please try again.',
      [AiErrorType.GRADING_FAILED]: 'Failed to grade answer. Please try again.',
      [AiErrorType.TIMEOUT]: 'Request timed out. Please try again.',
      [AiErrorType.UNKNOWN]: 'An unexpected error occurred. Please try again.',
    };

    let message = baseMessages[errorType] || baseMessages[AiErrorType.UNKNOWN];

    // Add context-specific details
    if (context.operation) {
      message += ` Operation: ${context.operation}`;
    }

    if (context.provider) {
      message += ` Provider: ${context.provider}`;
    }

    return message;
  }

  isRetryableError(error: Error): boolean {
    const retryableErrors = [
      'timeout',
      'network',
      'rate limit',
      'temporary',
      'unavailable',
      'connection',
    ];

    const errorMessage = error.message.toLowerCase();
    return retryableErrors.some((retryable) =>
      errorMessage.includes(retryable),
    );
  }

  getRetryDelay(attempt: number, baseDelay: number = 1000): number {
    // Exponential backoff with jitter
    const exponentialDelay = baseDelay * Math.pow(2, attempt - 1);
    const jitter = Math.random() * 0.1 * exponentialDelay;
    return Math.min(exponentialDelay + jitter, 30000); // Max 30 seconds
  }
}
