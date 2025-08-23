export interface IStripeCustomer {
  id: string;
  email: string;
  metadata?: Record<string, string>;
}

export interface IStripeCheckoutSession {
  id: string;
  url?: string;
  customer: string;
  subscription?: string;
  metadata?: Record<string, string>;
}

export interface IStripeSubscription {
  id: string;
  status: string;
  customer: string;
  current_period_start: number;
  current_period_end: number;
  cancel_at?: number;
  canceled_at?: number;
  metadata?: Record<string, string>;
  items: {
    data: Array<{
      price?: {
        id: string;
      };
    }>;
  };
}

export interface IStripeWebhookEvent {
  type: string;
  id: string;
  data: {
    object: any;
  };
}

export interface IStripeService {
  ensureCustomer(userId: string, email: string): Promise<string>;
  createCheckoutSession(
    userId: string,
    email: string,
    dto: any,
  ): Promise<{ url: string }>;
  handleWebhook(
    sig: string | string[] | undefined,
    rawBody: Buffer | string,
  ): Promise<{ received: boolean }>;
  getSubscriptionStatus(userId: string): Promise<any>;
  refreshSubscriptionStatus(userId: string): Promise<any>;
}
