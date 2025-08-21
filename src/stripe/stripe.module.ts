import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaModule } from 'src/prisma/prisma.module';
import Stripe from 'stripe';
import { StripeController } from './stripe.controller';
import { StripeService } from './stripe.service';
import { CustomerService } from './services/customer.service';
import { SubscriptionService } from './services/subscription.service';
import { WebhookHandlerService } from './services/webhook-handler.service';
import { WebhookProcessorService } from './services/webhook-processor.service';
import { PlanManagementService } from './services/plan-management.service';

@Module({
  imports: [PrismaModule],
  controllers: [StripeController],
  providers: [
    // Main services
    StripeService,
    CustomerService,
    SubscriptionService,
    WebhookHandlerService,
    WebhookProcessorService,
    PlanManagementService,
    
    // External service providers
    {
      provide: 'STRIPE',
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        return new Stripe(config.get<string>("STRIPE_SK") as string);
      }
    }
  ],
  exports: [StripeService, SubscriptionService, PlanManagementService],
})
export class StripeModule {}
