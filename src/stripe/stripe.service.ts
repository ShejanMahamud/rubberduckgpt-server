import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { CreateCheckoutDto } from './dto/create-stripe.dto';
import { IStripeService } from './interfaces/stripe.interface';
import { CustomerService } from './services/customer.service';
import { SubscriptionService } from './services/subscription.service';
import { WebhookProcessorService } from './services/webhook-processor.service';

@Injectable()
export class StripeService implements IStripeService {
  private readonly webhookSecret: string;

  constructor(
    @Inject('STRIPE') private readonly stripe: Stripe,
    private readonly customerService: CustomerService,
    private readonly subscriptionService: SubscriptionService,
    private readonly webhookProcessor: WebhookProcessorService,
    private readonly configService: ConfigService,
  ) {
    this.webhookSecret = this.configService.get(
      'STRIPE_WEBHOOK_SECRET',
    ) as string;
  }

  async ensureCustomer(userId: string, email: string): Promise<string> {
    return this.customerService.ensureCustomer(userId, email, this.stripe);
  }

  async createCheckoutSession(
    userId: string,
    email: string,
    dto: CreateCheckoutDto,
  ): Promise<{ url: string }> {
    const customerId = await this.ensureCustomer(userId, email);
    const priceId = dto.priceId;

    const session = await this.stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: dto.successUrl,
      cancel_url: dto.cancelUrl,
      allow_promotion_codes: true,
      subscription_data: {
        metadata: {
          userId,
          plan: dto.plan,
          interval: dto.interval,
        },
      },
      metadata: {
        userId,
        plan: dto.plan,
        interval: dto.interval,
      },
    });

    return { url: session.url || '' };
  }

  async handleWebhook(
    sig: string | string[] | undefined,
    rawBody: Buffer | string,
  ): Promise<{ received: boolean }> {
    try {
      const event = this.stripe.webhooks.constructEvent(
        rawBody,
        sig as string,
        this.webhookSecret,
      );
      return await this.webhookProcessor.processEvent(event);
    } catch (error) {
      console.error('Webhook signature verification failed:', error);
      throw new Error('Webhook signature verification failed');
    }
  }

  async getSubscriptionStatus(userId: string): Promise<any> {
    const status = await this.subscriptionService.getSubscriptionStatus(userId);

    return {
      success: true,
      message: 'Subscription status',
      data: status,
    };
  }

  async refreshSubscriptionStatus(userId: string): Promise<any> {
    try {
      // Get user's Stripe customer ID
      const customerId = await this.customerService.getCustomerByUserId(userId);
      if (!customerId) {
        return {
          success: false,
          message: 'No Stripe customer found',
          data: null,
        };
      }

      // Fetch all subscriptions from Stripe
      const subscriptions = await this.stripe.subscriptions.list({
        customer: customerId,
        status: 'active',
      });

      console.log(
        'Found subscriptions from Stripe:',
        subscriptions.data.length,
      );

      // Update our database with the latest Stripe data
      for (const subscription of subscriptions.data) {
        const metadata = subscription.metadata;
        const subscriptionUserId = metadata?.userId;
        const plan = metadata?.plan as 'BASIC' | 'PRO';
        const interval = metadata?.interval as 'MONTHLY' | 'YEARLY';

        if (subscriptionUserId && plan && interval) {
          await this.subscriptionService.upsertSubscription({
            id: subscription.id,
            userId: subscriptionUserId,
            plan,
            interval,
            status: 'ACTIVE',
            stripeCustomerId: subscription.customer as string,
            stripeSubscriptionId: subscription.id,
            stripePriceId: subscription.items.data[0]?.price?.id ?? null,
            currentPeriodStart: (subscription as any).current_period_start
              ? new Date((subscription as any).current_period_start * 1000)
              : null,
            currentPeriodEnd: (subscription as any).current_period_end
              ? new Date((subscription as any).current_period_end * 1000)
              : null,
            cancelAt: null,
            canceledAt: null,
          });
          console.log('Updated subscription in database:', {
            id: subscription.id,
            plan,
            interval,
          });
        }
      }

      // Return updated status
      return this.getSubscriptionStatus(userId);
    } catch (error) {
      console.error('Error refreshing subscription status:', error);
      return {
        success: false,
        message: 'Failed to refresh subscription status',
        error: error.message,
      };
    }
  }
}
