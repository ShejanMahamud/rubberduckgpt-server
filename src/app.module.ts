import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { AdminModule } from './admin/admin.module';
import { AiModule } from './ai/ai.module';
import { AppController } from './app.controller';
import { AuthModule } from './auth/auth.module';
import { RequestLoggerMiddleware } from './common/middlewares/req-middleware';
import { PrismaModule } from './prisma/prisma.module';
import { StripeModule } from './stripe/stripe.module';

@Module({
  imports: [
    PrismaModule,
    ThrottlerModule.forRoot([
      {
        name: 'short',
        ttl: 60000, // 1 minute
        limit: 3, // 3 requests per minute for auth routes
      },
      {
        name: 'medium',
        ttl: 900000, // 15 minutes
        limit: 10, // 10 requests per 15 minutes
      },
    ]),
    AuthModule,
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    AiModule,
    StripeModule,
    AdminModule,
  ],
  controllers: [AppController],
  providers: [],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestLoggerMiddleware).forRoutes('*'); // all routes
  }
}
