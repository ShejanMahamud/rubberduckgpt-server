import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AiModule } from './ai/ai.module';
import { AppController } from './app.controller';
import { AuthModule } from './auth/auth.module';
import { PrismaModule } from './prisma/prisma.module';
import { StripeModule } from './stripe/stripe.module';

@Module({
  imports: [PrismaModule,AuthModule,ConfigModule.forRoot({
    isGlobal: true,
    envFilePath: '.env',
  }), AiModule, StripeModule],
  controllers: [AppController],
  providers: [],
})
export class AppModule {}
