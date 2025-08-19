import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AuthModule } from './auth/auth.module';
import { PrismaModule } from './prisma/prisma.module';
import { AiModule } from './ai/ai.module';

@Module({
  imports: [PrismaModule,AuthModule,ConfigModule.forRoot({
    isGlobal: true,
    envFilePath: '.env',
  }), AiModule],
  controllers: [AppController],
  providers: [],
})
export class AppModule {}
