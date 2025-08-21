import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface AiModelConfig {
  name: string;
  maxTokens: number;
  temperature: number;
  supportsStreaming: boolean;
  supportsJsonSchema: boolean;
}

export interface AiProviderConfig {
  gemini: {
    apiKey: string;
    defaultModel: string;
    models: Record<string, AiModelConfig>;
  };
  groq: {
    apiKey: string;
    defaultModel: string;
    models: Record<string, AiModelConfig>;
  };
}

@Injectable()
export class AiConfigService {
  private readonly config: AiProviderConfig;

  constructor(private readonly configService: ConfigService) {
    this.config = {
      gemini: {
        apiKey: this.configService.get<string>('GEMINI_API_KEY') || '',
        defaultModel: 'gemini-2.0-flash-exp',
        models: {
          'gemini-2.0-flash-exp': {
            name: 'gemini-2.0-flash-exp',
            maxTokens: 8192,
            temperature: 0.7,
            supportsStreaming: true,
            supportsJsonSchema: false,
          },
          'gemini-1.5-pro': {
            name: 'gemini-1.5-pro',
            maxTokens: 32768,
            temperature: 0.7,
            supportsStreaming: true,
            supportsJsonSchema: false,
          },
        },
      },
      groq: {
        apiKey: this.configService.get<string>('GROQ_API_KEY') || '',
        defaultModel: 'openai/gpt-oss-120b',
        models: {
          'openai/gpt-oss-120b': {
            name: 'openai/gpt-oss-120b',
            maxTokens: 4096,
            temperature: 0.7,
            supportsStreaming: false,
            supportsJsonSchema: true,
          },
          'llama3-70b-8192': {
            name: 'llama3-70b-8192',
            maxTokens: 8192,
            temperature: 0.7,
            supportsStreaming: false,
            supportsJsonSchema: true,
          },
        },
      },
    };
  }

  getGeminiConfig() {
    return this.config.gemini;
  }

  getGroqConfig() {
    return this.config.groq;
  }

  getModelConfig(provider: 'gemini' | 'groq', modelName: string): AiModelConfig | null {
    return this.config[provider].models[modelName] || null;
  }

  getDefaultModel(provider: 'gemini' | 'groq'): string {
    return this.config[provider].defaultModel;
  }

  validateModel(provider: 'gemini' | 'groq', modelName: string): boolean {
    return !!this.config[provider].models[modelName];
  }

  getSupportedModels(provider: 'gemini' | 'groq'): string[] {
    return Object.keys(this.config[provider].models);
  }
}
