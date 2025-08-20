import { GoogleGenAI } from '@google/genai';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import Groq from 'groq-sdk';
import { AuthModule } from 'src/auth/auth.module';
import { PrismaModule } from 'src/prisma/prisma.module';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { InterviewGateway } from './interview.gateway';

@Module({
  imports: [PrismaModule, AuthModule, JwtModule.register({})],
  controllers: [AiController],
  providers: [AiService, InterviewGateway,
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
