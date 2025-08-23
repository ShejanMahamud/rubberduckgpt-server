export interface ISubscriptionData {
  id: string;
  userId: string;
  plan: 'FREE' | 'BASIC' | 'PRO';
  interval: 'MONTHLY' | 'YEARLY';
  status: 'INCOMPLETE' | 'ACTIVE' | 'PAST_DUE' | 'CANCELED';
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  stripePriceId?: string | null;
  currentPeriodStart?: Date | null;
  currentPeriodEnd?: Date | null;
  cancelAt?: Date | null;
  canceledAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ISubscriptionStatus {
  plan: 'FREE' | 'BASIC' | 'PRO';
  interval: 'MONTHLY' | 'YEARLY' | null;
  remaining: number | 'UNLIMITED';
  used: number;
  currentPeriodStart?: Date | null;
  currentPeriodEnd?: Date | null;
}

export interface ISubscriptionService {
  createSubscription(
    data: Omit<ISubscriptionData, 'id'>,
  ): Promise<ISubscriptionData>;
  updateSubscription(
    id: string,
    data: Partial<ISubscriptionData>,
  ): Promise<ISubscriptionData>;
  getActiveSubscription(userId: string): Promise<ISubscriptionData | null>;
  getSubscriptionStatus(userId: string): Promise<ISubscriptionStatus>;
  refreshFromStripe(userId: string): Promise<ISubscriptionStatus>;
}
