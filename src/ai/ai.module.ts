import { GoogleGenAI } from '@google/genai';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import Groq from 'groq-sdk';
import { AuthModule } from 'src/auth/auth.module';
import { PrismaModule } from 'src/prisma/prisma.module';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { PROVIDER_TOKENS } from './constants/provider-tokens';
import { InterviewGateway } from './interview.gateway';
import { GeminiChatProvider } from './providers/gemini-chat.provider';
import { GroqAiProvider } from './providers/groq-ai.provider';
import { AiConfigService } from './services/ai-config.service';
import { AiErrorService } from './services/ai-error.service';
import { AiRateLimitService } from './services/ai-rate-limit.service';
import { ChatService } from './services/chat.service';
import { InterviewService } from './services/interview.service';
import { PlanLimitsService } from './services/plan-limits.service';

@Module({
  imports: [PrismaModule, AuthModule, JwtModule.register({})],
  controllers: [AiController],
  providers: [
    // Main services
    AiService,
    ChatService,
    InterviewService,
    PlanLimitsService,
    AiConfigService,
    AiErrorService,
    AiRateLimitService,

    // AI Providers
    GroqAiProvider,
    GeminiChatProvider,

    // Gateway
    InterviewGateway,

    // External service providers
    {
      provide: PROVIDER_TOKENS.GEMINI,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        return new GoogleGenAI({
          apiKey: config.get<string>('GEMINI_API_KEY') as string,
        });
      },
    },
    {
      provide: PROVIDER_TOKENS.GROQ,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        return new Groq({
          apiKey: config.get<string>('GROQ_API_KEY') as string,
        });
      },
    },
    // Provider tokens
    {
      provide: PROVIDER_TOKENS.GEMINI_CHAT_PROVIDER,
      useExisting: GeminiChatProvider,
    },
    {
      provide: PROVIDER_TOKENS.GROQ_AI_PROVIDER,
      useExisting: GroqAiProvider,
    },
  ],
  exports: [AiService],
})
export class AiModule {}
