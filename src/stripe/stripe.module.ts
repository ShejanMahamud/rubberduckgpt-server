import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaModule } from 'src/prisma/prisma.module';
import Stripe from 'stripe';
import { StripeController } from './stripe.controller';
import { StripeService } from './stripe.service';

@Module({
  imports: [PrismaModule],
  controllers: [StripeController],
  providers: [StripeService,{
    provide: 'STRIPE',
    inject: [ConfigService],
    useFactory: (config: ConfigService) => {
      return new Stripe(config.get<string>("STRIPE_SK") as string)
    }
  }],
})
export class StripeModule {}
