import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

export interface IPlanLimit {
  id: string;
  plan: 'FREE' | 'BASIC' | 'PRO';
  maxInterviews: number;
  maxChatMessages: number;
  maxResumeUploads: number;
  isActive: boolean;
}

export interface IPlanManagementService {
  getPlanLimits(): Promise<IPlanLimit[]>;
  updatePlanLimit(plan: 'FREE' | 'BASIC' | 'PRO', data: Partial<IPlanLimit>): Promise<IPlanLimit>;
  createPlanLimit(data: Omit<IPlanLimit, 'id'>): Promise<IPlanLimit>;
  deletePlanLimit(plan: 'FREE' | 'BASIC' | 'PRO'): Promise<IPlanLimit>;
  getPlanLimit(plan: 'FREE' | 'BASIC' | 'PRO'): Promise<IPlanLimit | null>;
}

@Injectable()
export class PlanManagementService implements IPlanManagementService {
  constructor(private readonly prisma: PrismaService) {}

  async getPlanLimits(): Promise<IPlanLimit[]> {
    const limits = await this.prisma.planLimit.findMany({
      orderBy: { plan: 'asc' }
    });

    return limits;
  }

  async updatePlanLimit(plan: 'FREE' | 'BASIC' | 'PRO', data: Partial<IPlanLimit>): Promise<IPlanLimit> {
    // Validate plan name
    const validPlans = ['FREE', 'BASIC', 'PRO'] as const;
    if (!validPlans.includes(plan)) {
      throw new BadRequestException('Invalid plan name. Must be FREE, BASIC, or PRO.');
    }

    // Validate limits
    if (data.maxInterviews !== undefined && (data.maxInterviews < -1 || data.maxInterviews < 0)) {
      throw new BadRequestException('maxInterviews must be -1 (unlimited) or greater than 0.');
    }
    if (data.maxChatMessages !== undefined && (data.maxChatMessages < -1 || data.maxChatMessages < 0)) {
      throw new BadRequestException('maxChatMessages must be -1 (unlimited) or greater than 0.');
    }
    if (data.maxResumeUploads !== undefined && (data.maxResumeUploads < -1 || data.maxResumeUploads < 0)) {
      throw new BadRequestException('maxResumeUploads must be -1 (unlimited) or greater than 0.');
    }

    const updated = await this.prisma.planLimit.upsert({
      where: { plan },
      update: data,
      create: {
        plan,
        maxInterviews: data.maxInterviews ?? 0,
        maxChatMessages: data.maxChatMessages ?? 0,
        maxResumeUploads: data.maxResumeUploads ?? 0,
        isActive: data.isActive ?? true,
      }
    });

    return updated;
  }

  async createPlanLimit(data: Omit<IPlanLimit, 'id'>): Promise<IPlanLimit> {
    // Validate plan name
    const validPlans = ['FREE', 'BASIC', 'PRO'] as const;
    if (!validPlans.includes(data.plan)) {
      throw new BadRequestException('Invalid plan name. Must be FREE, BASIC, or PRO.');
    }

    // Check if plan already exists
    const existing = await this.prisma.planLimit.findUnique({
      where: { plan: data.plan }
    });

    if (existing) {
      throw new BadRequestException('Plan limit already exists. Use PUT to update.');
    }

    const created = await this.prisma.planLimit.create({
      data: {
        plan: data.plan,
        maxInterviews: data.maxInterviews,
        maxChatMessages: data.maxChatMessages,
        maxResumeUploads: data.maxResumeUploads,
        isActive: data.isActive
      }
    });

    return created;
  }

  async deletePlanLimit(plan: 'FREE' | 'BASIC' | 'PRO'): Promise<IPlanLimit> {
    const deleted = await this.prisma.planLimit.delete({
      where: { plan }
    });

    return deleted;
  }

  async getPlanLimit(plan: 'FREE' | 'BASIC' | 'PRO'): Promise<IPlanLimit | null> {
    return this.prisma.planLimit.findUnique({
      where: { plan }
    });
  }
}
