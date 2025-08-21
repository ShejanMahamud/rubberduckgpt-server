import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { PlanManagementService } from 'src/stripe/services/plan-management.service';

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly planManagementService: PlanManagementService,
  ) {}

  async getPlanLimits() {
    const limits = await this.planManagementService.getPlanLimits();

    return {
      success: true,
      message: 'Plan limits retrieved successfully',
      data: limits
    };
  }

  async updatePlanLimit(plan: 'FREE' | 'BASIC' | 'PRO', data: {
    maxInterviews: number;
    maxChatMessages: number;
    maxResumeUploads: number;
    isActive: boolean;
  }) {
    const updated = await this.planManagementService.updatePlanLimit(plan, data);

    return {
      success: true,
      message: 'Plan limit updated successfully',
      data: updated
    };
  }

  async createPlanLimit(data: {
    plan: 'FREE' | 'BASIC' | 'PRO';
    maxInterviews: number;
    maxChatMessages: number;
    maxResumeUploads: number;
    isActive: boolean;
  }) {
    const created = await this.planManagementService.createPlanLimit(data);

    return {
      success: true,
      message: 'Plan limit created successfully',
      data: created
    };
  }

  async deletePlanLimit(plan: 'FREE' | 'BASIC' | 'PRO') {
    const deleted = await this.planManagementService.deletePlanLimit(plan);

    return {
      success: true,
      message: 'Plan limit deleted successfully',
      data: deleted
    };
  }

  async getUsers() {
    const users = await this.prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        username: true,
        role: true,
        isActive: true,
        isPremium: true,
        createdAt: true,
        _count: {
          select: {
            interviewSessions: true,
            chatSessions: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return {
      success: true,
      message: 'Users retrieved successfully',
      data: users
    };
  }

  async getStats() {
    const [
      totalUsers,
      totalInterviews,
      totalChatSessions,
      totalMessages,
      activeSubscriptions
    ] = await Promise.all([
      this.prisma.user.count({ where: { isDeleted: false } }),
      this.prisma.interviewSession.count(),
      this.prisma.chatSession.count(),
      this.prisma.chatMessage.count(),
      this.prisma.subscription.count({ where: { status: 'ACTIVE' } })
    ]);

    return {
      success: true,
      message: 'Stats retrieved successfully',
      data: {
        totalUsers,
        totalInterviews,
        totalChatSessions,
        totalMessages,
        activeSubscriptions
      }
    };
  }
}
