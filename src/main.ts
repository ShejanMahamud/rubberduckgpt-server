import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { raw } from 'express';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const clientOrigin = process.env.CLIENT_ORIGIN || 'http://localhost:3000';
  app.enableCors({
    origin: [clientOrigin],
    credentials: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: ['Content-Type', 'Authorization', 'Stripe-Signature'],
  });
  // Stripe requires the raw body to validate webhooks
  app.use('/v1/api/stripe/webhook', raw({ type: '*/*' }));
  //a logger
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.setGlobalPrefix('v1/api');
  await app.listen(process.env.PORT ?? 4000);
}
bootstrap();
