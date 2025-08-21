import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { AdminGuard } from './admin.guard';
import { AdminService } from './admin.service';

type PlanType = 'FREE' | 'BASIC' | 'PRO';

interface PlanLimitBody {
  maxInterviews: number;
  maxChatMessages: number;
  maxResumeUploads: number;
  isActive: boolean;
}

interface CreatePlanLimitBody extends PlanLimitBody {
  plan: PlanType;
}

@Controller('admin')
@UseGuards(AdminGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('plan-limits')
  async getPlanLimits() {
    return this.adminService.getPlanLimits();
  }

  @Put('plan-limits/:plan')
  async updatePlanLimit(
    @Param('plan') plan: PlanType,
    @Body() body: PlanLimitBody
  ) {
    return this.adminService.updatePlanLimit(plan, body);
  }

  @Post('plan-limits')
  async createPlanLimit(
    @Body() body: CreatePlanLimitBody
  ) {
    return this.adminService.createPlanLimit(body);
  }

  @Delete('plan-limits/:plan')
  async deletePlanLimit(@Param('plan') plan: PlanType) {
    return this.adminService.deletePlanLimit(plan);
  }

  @Get('users')
  async getUsers() {
    return this.adminService.getUsers();
  }

  @Get('stats')
  async getStats() {
    return this.adminService.getStats();
  }
}
