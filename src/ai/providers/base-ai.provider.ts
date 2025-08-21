import { Injectable, Logger } from "@nestjs/common";

export interface AiProviderOptions {
  maxRetries?: number;
  retryDelay?: number;
  timeout?: number;
}

@Injectable()
export abstract class BaseAiProvider {
  protected readonly logger = new Logger(this.constructor.name);
  protected readonly options: Required<AiProviderOptions>;

  constructor(options: AiProviderOptions = {}) {
    this.options = {
      maxRetries: options.maxRetries ?? 3,
      retryDelay: options.retryDelay ?? 1000,
      timeout: options.timeout ?? 30000,
    };
  }

  protected async executeWithRetry<T>(
    operation: () => Promise<T>,
    operationName: string,
    context: any = {}
  ): Promise<T> {
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= this.options.maxRetries; attempt++) {
      try {
        this.logger.debug(
          `Attempting ${operationName} (attempt ${attempt}/${this.options.maxRetries})`,
          context
        );

        const result = await Promise.race([
          operation(),
          this.createTimeoutPromise(),
        ]);

        if (attempt > 1) {
          this.logger.log(
            `${operationName} succeeded on attempt ${attempt}`,
            context
          );
        }

        return result;
      } catch (error) {
        lastError = error as Error;
        this.logger.warn(
          `${operationName} failed on attempt ${attempt}/${this.options.maxRetries}: ${error.message}`,
          { ...context, error: error.message, attempt }
        );

        if (attempt < this.options.maxRetries) {
          await this.delay(this.options.retryDelay * attempt);
        }
      }
    }

    this.logger.error(
      `${operationName} failed after ${this.options.maxRetries} attempts`,
      {
        ...context,
        error: lastError?.message,
        maxRetries: this.options.maxRetries,
      }
    );

    throw new Error(
      `${operationName} failed after ${this.options.maxRetries} attempts: ${lastError?.message}`
    );
  }

  // Alias for backward compatibility
  protected async withRetry<T>(
    operation: () => Promise<T>,
    operationName: string,
    context: any = {}
  ): Promise<T> {
    return this.executeWithRetry(operation, operationName, context);
  }

  private createTimeoutPromise(): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(
          new Error(`Operation timed out after ${this.options.timeout}ms`)
        );
      }, this.options.timeout);
    });
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  protected logOperation(operation: string, context?: Record<string, any>) {
    this.logger.log(`Starting ${operation}`, context);
  }

  protected logSuccess(operation: string, context?: Record<string, any>) {
    this.logger.log(`Completed ${operation} successfully`, context);
  }

  protected logError(
    operation: string,
    error: Error,
    context?: Record<string, any>
  ) {
    this.logger.error(`Failed ${operation}: ${error.message}`, {
      ...context,
      error: error.message,
      stack: error.stack,
    });
  }
}
