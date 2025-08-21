import { Injectable } from '@nestjs/common';
import { IWebhookEventProcessor } from '../interfaces/webhook.interface';
import { WebhookHandlerService } from './webhook-handler.service';

@Injectable()
export class WebhookProcessorService implements IWebhookEventProcessor {
  constructor(private readonly webhookHandler: WebhookHandlerService) {}

  async processEvent(event: any): Promise<{ received: boolean }> {
    console.log('Webhook received:', event.type, event.id);

    try {
      switch (event.type) {
        case 'checkout.session.completed': {
          const session = event.data.object;
          await this.webhookHandler.handleCheckoutSessionCompleted(session);
          break;
        }
        case 'customer.subscription.updated': {
          const subscription = event.data.object;
          await this.webhookHandler.handleSubscriptionUpdated(subscription);
          break;
        }
        case 'customer.subscription.created': {
          const subscription = event.data.object;
          await this.webhookHandler.handleSubscriptionCreated(subscription);
          break;
        }
        case 'customer.subscription.deleted': {
          const subscription = event.data.object;
          await this.webhookHandler.handleSubscriptionDeleted(subscription);
          break;
        }
        default:
          console.log('Unhandled webhook event type:', event.type);
          break;
      }
    } catch (error) {
      console.error('Error processing webhook event:', error);
      throw error;
    }

    return { received: true };
  }
}
