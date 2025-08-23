export interface IWebhookHandler {
  handleCheckoutSessionCompleted(session: any): Promise<void>;
  handleSubscriptionUpdated(subscription: any): Promise<void>;
  handleSubscriptionCreated(subscription: any): Promise<void>;
  handleSubscriptionDeleted(subscription: any): Promise<void>;
}

export interface IWebhookEventProcessor {
  processEvent(event: any): Promise<{ received: boolean }>;
}

export interface IStripeWebhookProcessor {
  constructEvent(
    payload: Buffer | string,
    signature: string,
    secret: string,
  ): any;
}
