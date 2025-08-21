import { GoogleGenAI } from '@google/genai';
import { Inject, Injectable } from '@nestjs/common';
import { IChatProvider } from '../interfaces/ai-provider.interface';
import { AiConfigService } from '../services/ai-config.service';
import { BaseAiProvider } from './base-ai.provider';

@Injectable()
export class GeminiChatProvider extends BaseAiProvider implements IChatProvider {
  constructor(
    @Inject('GEMINI') private readonly gemini: GoogleGenAI,
    private readonly configService: AiConfigService,
  ) {
    super({ maxRetries: 3, retryDelay: 1000, timeout: 30000 });
  }

  async sendMessage(
    messages: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }>,
    prompt: string,
    model: string
  ): Promise<{ text: string; chunks: string[] }> {
    const operationName = 'sendMessage';
    const context = { 
      messageCount: messages.length, 
      promptLength: prompt.length, 
      model,
      provider: 'gemini' 
    };
    
    this.logOperation(operationName, context);
    
    try {
      // Validate model
      if (!this.configService.validateModel('gemini', model)) {
        throw new Error(`Unsupported model: ${model}`);
      }
      
      const result = await this.withRetry(
        () => this.sendMessageInternal(messages, prompt, model),
        operationName,
        context
      );
      
      this.logSuccess(operationName, { ...context, responseLength: result.text.length });
      return result;
    } catch (error) {
      this.logError(operationName, error as Error, context);
      throw new Error(`Failed to send message: ${error.message}`);
    }
  }

  private async sendMessageInternal(
    messages: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }>,
    prompt: string,
    model: string
  ): Promise<{ text: string; chunks: string[] }> {
    // Create Gemini chat instance with history
    const chat = this.gemini.chats.create({
      model,
      history: messages,
    });

    // Send message to Gemini
    const response = await chat.sendMessageStream({
      message: prompt.trim(),
    });

    let fullResponse = '';
    const responseChunks: string[] = [];

    // Collect streaming response
    for await (const chunk of response) {
      if (chunk.text) {
        fullResponse += chunk.text;
        responseChunks.push(chunk.text);
      }
    }

    if (!fullResponse.trim()) {
      throw new Error('Empty response from AI provider');
    }

    return { text: fullResponse, chunks: responseChunks };
  }
}
