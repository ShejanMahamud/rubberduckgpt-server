import { Injectable } from '@nestjs/common';
import { IWebhookHandler } from '../interfaces/webhook.interface';
import { SubscriptionService } from './subscription.service';

@Injectable()
export class WebhookHandlerService implements IWebhookHandler {
  constructor(private readonly subscriptionService: SubscriptionService) {}

  async handleCheckoutSessionCompleted(session: any): Promise<void> {
    const customerId = session.customer as string | null;
    const subscriptionId = session.subscription as string | null;
    const userId = session.metadata?.userId as string | undefined;
    const plan = session.metadata?.plan as 'BASIC' | 'PRO';
    const interval = session.metadata?.interval as 'MONTHLY' | 'YEARLY';
    
    console.log('Checkout session completed:', { userId, plan, interval, subscriptionId });
    
    if (!userId || !plan || !interval) {
      console.error('Missing metadata in checkout session:', session.metadata);
      return;
    }

    // Create or update subscription in database
    await this.subscriptionService.upsertSubscription({
      id: subscriptionId as string,
      userId,
      plan,
      interval,
      status: 'ACTIVE',
      stripeCustomerId: customerId ?? null,
      stripeSubscriptionId: subscriptionId ?? null,
      stripePriceId: null, // Will be updated when subscription is retrieved
      currentPeriodStart: undefined, // Will be updated when subscription is retrieved
      currentPeriodEnd: undefined, // Will be updated when subscription is retrieved
      cancelAt: null,
      canceledAt: null,
    });
    
    console.log('Subscription created/updated in database from checkout session');
  }

  async handleSubscriptionUpdated(subscription: any): Promise<void> {
    await this.processSubscriptionEvent(subscription, 'updated');
  }

  async handleSubscriptionCreated(subscription: any): Promise<void> {
    await this.processSubscriptionEvent(subscription, 'created');
  }

  async handleSubscriptionDeleted(subscription: any): Promise<void> {
    await this.processSubscriptionEvent(subscription, 'deleted');
  }

  private async processSubscriptionEvent(subscription: any, eventType: string): Promise<void> {
    const priceId = subscription.items.data[0]?.price?.id;
    
    // Extract metadata from subscription
    const userId = subscription.metadata?.userId;
    const plan = subscription.metadata?.plan as 'BASIC' | 'PRO';
    const interval = subscription.metadata?.interval as 'MONTHLY' | 'YEARLY';
    
    console.log('Subscription event:', eventType, { 
      subscriptionId: subscription.id, 
      userId, 
      plan, 
      interval, 
      status: subscription.status,
      metadata: subscription.metadata 
    });
    
    if (!userId || !plan || !interval) {
      console.warn('Missing metadata in subscription webhook:', { subscriptionId: subscription.id, metadata: subscription.metadata });
      return;
    }
    
    const status = this.mapStripeStatusToInternal(subscription.status);
    
    await this.subscriptionService.upsertSubscription({
      id: subscription.id,
      userId,
      plan,
      interval,
      status,
      stripeCustomerId: subscription.customer as string,
      stripeSubscriptionId: subscription.id,
      stripePriceId: priceId,
      currentPeriodStart: subscription.current_period_start ? new Date(subscription.current_period_start * 1000) : null,
      currentPeriodEnd: subscription.current_period_end ? new Date(subscription.current_period_end * 1000) : null,
      cancelAt: subscription.cancel_at ? new Date(subscription.cancel_at * 1000) : null,
      canceledAt: subscription.canceled_at ? new Date(subscription.canceled_at * 1000) : null,
    });
    
    console.log('Subscription updated in database:', { id: subscription.id, plan, interval, status });
  }

  private mapStripeStatusToInternal(stripeStatus: string): 'INCOMPLETE' | 'ACTIVE' | 'PAST_DUE' | 'CANCELED' {
    switch (stripeStatus) {
      case 'active':
        return 'ACTIVE';
      case 'past_due':
        return 'PAST_DUE';
      case 'canceled':
        return 'CANCELED';
      default:
        return 'INCOMPLETE';
    }
  }
}
