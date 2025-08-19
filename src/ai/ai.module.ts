import { GoogleGenAI } from '@google/genai';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Groq from 'groq-sdk';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';

@Module({
  controllers: [AiController],
  providers: [AiService,
    {
      provide: 'GEMINI',
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
          return new GoogleGenAI({
            apiKey: config.get<string>("GEMINI_API_KEY") as string
          })
      }
    },
    {
      provide: 'GROQ',
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
          return new Groq({
            apiKey: config.get<string>("GROQ_API_KEY") as string
          })
      }
    }
  ],
})
export class AiModule {}
