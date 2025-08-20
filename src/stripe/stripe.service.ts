import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from 'src/prisma/prisma.service';
import Stripe from 'stripe';
import { CreateCheckoutDto } from './dto/create-stripe.dto';

@Injectable()
export class StripeService {
  webhookSecret: string;

  constructor(
    @Inject('STRIPE') private readonly stripe: Stripe,
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ){
    this.webhookSecret = this.configService.get('STRIPE_WEBHOOK_SECRET') as string;
  }

  async ensureCustomer(userId: string, email: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    if (user.stripeCustomerId) return user.stripeCustomerId;

    const customer = await this.stripe.customers.create({ email, metadata: { userId } });
    await this.prisma.user.update({ where: { id: userId }, data: { stripeCustomerId: customer.id } });
    return customer.id;
  }

  async createCheckoutSession(userId: string, email: string, dto: CreateCheckoutDto) {
    const customerId = await this.ensureCustomer(userId, email);
    const priceId = dto.priceId;

    const session = await this.stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: dto.successUrl,
      cancel_url: dto.cancelUrl,
      allow_promotion_codes: true,
      metadata: {
        userId,
        plan: dto.plan,
        interval: dto.interval,
      },
    });
    return { url: session.url };
  }

  async handleWebhook(sig: string | string[] | undefined, rawBody: Buffer | string) {
    const endpointSecret = this.webhookSecret;
    const event = this.stripe.webhooks.constructEvent(rawBody, sig as string, endpointSecret);

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const customerId = session.customer as string | null;
        const subscriptionId = session.subscription as string | null;
        const userId = session.metadata?.userId as string | undefined;
        const plan = session.metadata?.plan as 'BASIC' | 'PRO';
        const interval = session.metadata?.interval as 'MONTHLY' | 'YEARLY';
        if (!userId || !plan || !interval) break;

        const subscription = await this.stripe.subscriptions.retrieve(subscriptionId as string, { expand: ['latest_invoice', 'items'] }) as unknown as Stripe.Subscription;
        await this.prisma.subscription.upsert({
          where: { id: subscription.id },
          create: {
            id: subscription.id,
            userId,
            plan,
            interval,
            status: 'ACTIVE',
            stripeCustomerId: customerId ?? undefined,
            stripeSubscriptionId: subscription.id,
            stripePriceId: subscription.items.data[0]?.price?.id,
            currentPeriodStart: (subscription as any)["current_period_start"] ? new Date(((subscription as any)["current_period_start"] as number) * 1000) : undefined,
            currentPeriodEnd: (subscription as any)["current_period_end"] ? new Date(((subscription as any)["current_period_end"] as number) * 1000) : undefined,
          },
          update: {
            status: 'ACTIVE',
            stripeCustomerId: customerId ?? undefined,
            stripeSubscriptionId: subscription.id,
            stripePriceId: subscription.items.data[0]?.price?.id,
            currentPeriodStart: (subscription as any)["current_period_start"] ? new Date(((subscription as any)["current_period_start"] as number) * 1000) : undefined,
            currentPeriodEnd: (subscription as any)["current_period_end"] ? new Date(((subscription as any)["current_period_end"] as number) * 1000) : undefined,
          },
        });
        break;
      }
      case 'customer.subscription.updated':
      case 'customer.subscription.created':
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const priceId = subscription.items.data[0]?.price?.id;
        await this.prisma.subscription.upsert({
          where: { id: subscription.id },
          create: {
            id: subscription.id,
            userId: subscription.metadata?.userId || '',
            plan: (subscription.metadata?.plan as any) || 'BASIC',
            interval: (subscription.metadata?.interval as any) || 'MONTHLY',
            status: subscription.status === 'active' ? 'ACTIVE' : subscription.status === 'past_due' ? 'PAST_DUE' : subscription.status === 'canceled' ? 'CANCELED' : 'INCOMPLETE',
            stripeCustomerId: subscription.customer as string,
            stripeSubscriptionId: subscription.id,
            stripePriceId: priceId,
            currentPeriodStart: (subscription as any)["current_period_start"] ? new Date(((subscription as any)["current_period_start"] as number) * 1000) : undefined,
            currentPeriodEnd: (subscription as any)["current_period_end"] ? new Date(((subscription as any)["current_period_end"] as number) * 1000) : undefined,
            cancelAt: subscription.cancel_at ? new Date(subscription.cancel_at * 1000) : null,
            canceledAt: subscription.canceled_at ? new Date(subscription.canceled_at * 1000) : null,
          },
          update: {
            status: subscription.status === 'active' ? 'ACTIVE' : subscription.status === 'past_due' ? 'PAST_DUE' : subscription.status === 'canceled' ? 'CANCELED' : 'INCOMPLETE',
            stripeCustomerId: subscription.customer as string,
            stripeSubscriptionId: subscription.id,
            stripePriceId: priceId,
            currentPeriodStart: (subscription as any)["current_period_start"] ? new Date(((subscription as any)["current_period_start"] as number) * 1000) : undefined,
            currentPeriodEnd: (subscription as any)["current_period_end"] ? new Date(((subscription as any)["current_period_end"] as number) * 1000) : undefined,
            cancelAt: subscription.cancel_at ? new Date(subscription.cancel_at * 1000) : null,
            canceledAt: subscription.canceled_at ? new Date(subscription.canceled_at * 1000) : null,
          },
        });
        break;
      }
      default:
        break;
    }
    return { received: true };
  }

  async getSubscriptionStatus(userId: string) {
    const now = new Date();
    const sub = await this.prisma.subscription.findFirst({
      where: {
        userId,
        status: 'ACTIVE',
        OR: [
          { currentPeriodEnd: null },
          { currentPeriodEnd: { gt: now } },
        ],
      },
    });

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
        used = await this.prisma.interviewSession.count({ where: { userId, createdAt: { gte: start, lte: end } } });
        remaining = Math.max(0, 10 - used);
      }
    } else {
      used = await this.prisma.interviewSession.count({ where: { userId } });
      remaining = Math.max(0, 2 - used);
    }

    return {
      success: true,
      message: 'Subscription status',
      data: { plan, interval, remaining, used },
    };
  }
}
