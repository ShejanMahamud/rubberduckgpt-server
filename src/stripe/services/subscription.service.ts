import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  ISubscriptionData,
  ISubscriptionService,
  ISubscriptionStatus,
} from '../interfaces/subscription.interface';

@Injectable()
export class SubscriptionService implements ISubscriptionService {
  constructor(private readonly prisma: PrismaService) {}

  async createSubscription(
    data: Omit<ISubscriptionData, 'id'>,
  ): Promise<ISubscriptionData> {
    const subscription = await this.prisma.subscription.create({
      data: {
        userId: data.userId,
        plan: data.plan,
        interval: data.interval,
        status: data.status,
        stripeCustomerId: data.stripeCustomerId,
        stripeSubscriptionId: data.stripeSubscriptionId,
        stripePriceId: data.stripePriceId,
        currentPeriodStart: data.currentPeriodStart,
        currentPeriodEnd: data.currentPeriodEnd,
        cancelAt: data.cancelAt,
        canceledAt: data.canceledAt,
      },
    });

    return subscription;
  }

  async updateSubscription(
    id: string,
    data: Partial<ISubscriptionData>,
  ): Promise<ISubscriptionData> {
    const subscription = await this.prisma.subscription.update({
      where: { id },
      data: {
        ...(data.plan && { plan: data.plan }),
        ...(data.interval && { interval: data.interval }),
        ...(data.status && { status: data.status }),
        ...(data.stripeCustomerId && {
          stripeCustomerId: data.stripeCustomerId,
        }),
        ...(data.stripeSubscriptionId && {
          stripeSubscriptionId: data.stripeSubscriptionId,
        }),
        ...(data.stripePriceId && { stripePriceId: data.stripePriceId }),
        ...(data.currentPeriodStart && {
          currentPeriodStart: data.currentPeriodStart,
        }),
        ...(data.currentPeriodEnd && {
          currentPeriodEnd: data.currentPeriodEnd,
        }),
        ...(data.cancelAt !== undefined && { cancelAt: data.cancelAt }),
        ...(data.canceledAt !== undefined && { canceledAt: data.canceledAt }),
      },
    });

    return subscription;
  }

  async getActiveSubscription(
    userId: string,
  ): Promise<ISubscriptionData | null> {
    const now = new Date();
    return this.prisma.subscription.findFirst({
      where: {
        userId,
        status: 'ACTIVE',
        OR: [{ currentPeriodEnd: null }, { currentPeriodEnd: { gt: now } }],
      },
    });
  }

  async getSubscriptionStatus(userId: string): Promise<ISubscriptionStatus> {
    const now = new Date();
    const sub = await this.getActiveSubscription(userId);

    let plan: 'FREE' | 'BASIC' | 'PRO' = 'FREE';
    let interval: 'MONTHLY' | 'YEARLY' | null = null;
    let remaining: number | 'UNLIMITED' = 2;
    let used = 0;

    if (sub) {
      plan = sub.plan as any;
      interval = sub.interval as any;

      if (plan === 'PRO') {
        remaining = 'UNLIMITED';
      } else if (plan === 'BASIC') {
        const start = sub.currentPeriodStart ?? now;
        const end = sub.currentPeriodEnd ?? now;
        used = await this.prisma.interviewSession.count({
          where: {
            userId,
            createdAt: { gte: start, lte: end },
          },
        });
        remaining = Math.max(0, 10 - used);
      }
    } else {
      used = await this.prisma.interviewSession.count({ where: { userId } });
      remaining = Math.max(0, 2 - used);
    }

    return {
      plan,
      interval,
      remaining,
      used,
      currentPeriodStart: sub?.currentPeriodStart,
      currentPeriodEnd: sub?.currentPeriodEnd,
    };
  }

  async refreshFromStripe(userId: string): Promise<ISubscriptionStatus> {
    // This method will be implemented by the Stripe service
    // For now, just return the current status
    return this.getSubscriptionStatus(userId);
  }

  async upsertSubscription(
    data: ISubscriptionData,
  ): Promise<ISubscriptionData> {
    return this.prisma.subscription.upsert({
      where: { id: data.id },
      create: data,
      update: data,
    });
  }

  async getSubscriptionById(id: string): Promise<ISubscriptionData | null> {
    return this.prisma.subscription.findUnique({
      where: { id },
    });
  }

  async getSubscriptionsByUserId(userId: string): Promise<ISubscriptionData[]> {
    return this.prisma.subscription.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }
}
