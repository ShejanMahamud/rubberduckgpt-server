import { GoogleGenAI } from '@google/genai';
import { Inject, Injectable } from '@nestjs/common';
import { IChatProvider } from '../interfaces/ai-provider.interface';
import { AiConfigService } from '../services/ai-config.service';
import { BaseAiProvider } from './base-ai.provider';

@Injectable()
export class GeminiChatProvider
  extends BaseAiProvider
  implements IChatProvider
{
  constructor(
    @Inject('GEMINI') private readonly gemini: GoogleGenAI,
    private readonly configService: AiConfigService,
  ) {
    super({ maxRetries: 3, retryDelay: 1000, timeout: 30000 });
  }

  async sendMessage(
    messages: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }>,
    prompt: string,
    model: string,
  ): Promise<{ text: string; chunks: string[] }> {
    const operationName = 'sendMessage';
    const context = {
      messageCount: messages.length,
      promptLength: prompt.length,
      model,
      provider: 'gemini',
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
        context,
      );

      this.logSuccess(operationName, {
        ...context,
        responseLength: result.text.length,
      });
      return result;
    } catch (error) {
      this.logError(operationName, error as Error, context);
      throw new Error(`Failed to send message: ${error.message}`);
    }
  }

  private async sendMessageInternal(
    messages: Array<{
      role: 'user' | 'model';
      parts: Array<{ text: string }>;
    }>,
    prompt: string,
    model: string,
  ): Promise<{ text: string; chunks: string[] }> {
    // Create Gemini chat instance with history
    const chat = this.gemini.chats.create({
      model,
      history: [
        ...messages,
        {
          role: 'model',
          parts: [
            {
              text: `
You are InterVie, a professional AI career and job interview assistant. Your purpose is to help users succeed in job interviews, improve their project skills, and enhance employability. 
Follow these guidelines strictly:

1. **Interview Preparation**: 
   - Provide common and role-specific interview questions.
   - Give clear, concise, and structured answers.
   - Include tips on how to answer effectively, including phrasing, tone, and examples.

2. **Project Guidance**: 
   - Suggest project ideas relevant to the user's field or role.
   - Explain step-by-step how to approach the project.
   - Recommend tools, libraries, or frameworks when necessary.

3. **Feedback**: 
   - Give constructive feedback on the user’s answers or ideas.
   - Highlight strengths and areas for improvement.

4. **Professionalism**: 
   - Maintain a helpful, polite, and encouraging tone.
   - Adapt your responses to the user’s skill level.
   - Avoid giving irrelevant or generic advice.

5. **Extra Guidance**: 
   - Provide resources (articles, tutorials, sample projects) when relevant.
   - Offer soft skills and behavioral tips for interviews.
   - Suggest ways to demonstrate experience and impact effectively.

Always act as a knowledgeable career coach, tailor advice to the user's background and goals, and make answers actionable and easy to understand.
          `.trim(),
            },
          ],
        },
      ],
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
