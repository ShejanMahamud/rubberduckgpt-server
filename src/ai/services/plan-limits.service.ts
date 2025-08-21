import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { IPlanLimits, ISubscriptionInfo, ILimitEnforcement } from '../interfaces/plan-limits.interface';

@Injectable()
export class PlanLimitsService implements ILimitEnforcement {
  constructor(private readonly prisma: PrismaService) {}

  async enforceInterviewLimit(userId: string): Promise<void> {
    const subscriptionInfo = await this.getSubscriptionInfo(userId);
    const planLimit = await this.getPlanLimit(subscriptionInfo.planType);
    
    if (planLimit.maxInterviews === -1) return; // Unlimited

    if (subscriptionInfo.isActive && subscriptionInfo.planType !== 'FREE') {
      // Subscription plans: check billing period limits
      const used = await this.getPeriodInterviewCount(userId, subscriptionInfo);
      if (used >= planLimit.maxInterviews) {
        throw new UnauthorizedException(
          `${subscriptionInfo.planType} plan monthly limit reached (${planLimit.maxInterviews} interviews). Upgrade to continue.`
        );
      }
    } else {
      // FREE plan: check total lifetime limit
      const total = await this.prisma.interviewSession.count({ where: { userId } });
      if (total >= planLimit.maxInterviews) {
        throw new UnauthorizedException(
          `${subscriptionInfo.planType} plan limit reached (${planLimit.maxInterviews} interviews). Upgrade to continue.`
        );
      }
    }
  }

  async enforceChatLimit(userId: string): Promise<void> {
    const subscriptionInfo = await this.getSubscriptionInfo(userId);
    const planLimit = await this.getPlanLimit(subscriptionInfo.planType);
    
    if (planLimit.maxChatMessages === -1) return; // Unlimited

    if (subscriptionInfo.isActive && subscriptionInfo.planType !== 'FREE') {
      // Subscription plans: check billing period limits
      const used = await this.getPeriodChatMessageCount(userId, subscriptionInfo);
      if (used >= planLimit.maxChatMessages) {
        throw new UnauthorizedException(
          `${subscriptionInfo.planType} plan monthly limit reached (${planLimit.maxChatMessages} messages). Upgrade to continue.`
        );
      }
    } else {
      // FREE plan: check total lifetime limit
      const total = await this.prisma.chatMessage.count({
        where: { session: { userId } }
      });
      if (total >= planLimit.maxChatMessages) {
        throw new UnauthorizedException(
          `${subscriptionInfo.planType} plan limit reached (${planLimit.maxChatMessages} messages). Upgrade to continue.`
        );
      }
    }
  }

  async enforceResumeUploadLimit(userId: string): Promise<void> {
    const subscriptionInfo = await this.getSubscriptionInfo(userId);
    const planLimit = await this.getPlanLimit(subscriptionInfo.planType);
    
    if (planLimit.maxResumeUploads === -1) return; // Unlimited

    if (subscriptionInfo.isActive && subscriptionInfo.planType !== 'FREE') {
      // Subscription plans: check billing period limits
      const used = await this.getPeriodResumeUploadCount(userId, subscriptionInfo);
      if (used >= planLimit.maxResumeUploads) {
        throw new UnauthorizedException(
          `${subscriptionInfo.planType} plan monthly limit reached (${planLimit.maxResumeUploads} resume uploads). Upgrade to continue.`
        );
      }
    } else {
      // FREE plan: check total lifetime limit
      const total = await this.prisma.interviewSession.count({
        where: { 
          userId,
          resumeText: { not: null }
        }
      });
      if (total >= planLimit.maxResumeUploads) {
        throw new UnauthorizedException(
          `${subscriptionInfo.planType} plan limit reached (${planLimit.maxResumeUploads} resume uploads). Upgrade to continue.`
        );
      }
    }
  }

  private async getSubscriptionInfo(userId: string): Promise<ISubscriptionInfo> {
    const now = new Date();
    const activeSub = await this.prisma.subscription.findFirst({
      where: {
        userId,
        status: 'ACTIVE',
        OR: [
          { currentPeriodEnd: null },
          { currentPeriodEnd: { gt: now } },
        ],
      },
    });

    return {
      planType: activeSub?.plan || 'FREE',
      isActive: !!activeSub,
      currentPeriodStart: activeSub?.currentPeriodStart,
      currentPeriodEnd: activeSub?.currentPeriodEnd,
    };
  }

  private async getPlanLimit(planType: 'FREE' | 'BASIC' | 'PRO'): Promise<IPlanLimits> {
    const planLimit = await this.prisma.planLimit.findFirst({
      where: { plan: planType, isActive: true }
    });

    if (!planLimit) {
      throw new UnauthorizedException('Plan limits not configured. Please contact support.');
    }

    return {
      maxInterviews: planLimit.maxInterviews,
      maxChatMessages: planLimit.maxChatMessages,
      maxResumeUploads: planLimit.maxResumeUploads,
    };
  }

  private async getPeriodInterviewCount(userId: string, subscriptionInfo: ISubscriptionInfo): Promise<number> {
    const now = new Date();
    const periodStart = subscriptionInfo.currentPeriodStart ?? new Date(now.getFullYear(), now.getMonth(), 1);
    const periodEnd = subscriptionInfo.currentPeriodEnd ?? new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    
    return this.prisma.interviewSession.count({
      where: {
        userId,
        createdAt: { gte: periodStart, lte: periodEnd },
      },
    });
  }

  private async getPeriodChatMessageCount(userId: string, subscriptionInfo: ISubscriptionInfo): Promise<number> {
    const now = new Date();
    const periodStart = subscriptionInfo.currentPeriodStart ?? new Date(now.getFullYear(), now.getMonth(), 1);
    const periodEnd = subscriptionInfo.currentPeriodEnd ?? new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    
    return this.prisma.chatMessage.count({
      where: {
        session: { userId },
        createdAt: { gte: periodStart, lte: periodEnd },
      },
    });
  }

  private async getPeriodResumeUploadCount(userId: string, subscriptionInfo: ISubscriptionInfo): Promise<number> {
    const now = new Date();
    const periodStart = subscriptionInfo.currentPeriodStart ?? new Date(now.getFullYear(), now.getMonth(), 1);
    const periodEnd = subscriptionInfo.currentPeriodEnd ?? new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    
    return this.prisma.interviewSession.count({
      where: {
        userId,
        resumeText: { not: null },
        createdAt: { gte: periodStart, lte: periodEnd },
      },
    });
  }
}
