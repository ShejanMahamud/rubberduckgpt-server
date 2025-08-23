import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class CustomerService {
  constructor(private readonly prisma: PrismaService) {}

  async ensureCustomer(
    userId: string,
    email: string,
    stripe: any,
  ): Promise<string> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    if (user.stripeCustomerId) return user.stripeCustomerId;

    const customer = await stripe.customers.create({
      email,
      metadata: { userId },
    });

    await this.prisma.user.update({
      where: { id: userId },
      data: { stripeCustomerId: customer.id },
    });

    return customer.id;
  }

  async getCustomerByUserId(userId: string): Promise<string | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { stripeCustomerId: true },
    });

    return user?.stripeCustomerId ?? null;
  }

  async updateCustomerMetadata(
    userId: string,
    metadata: Record<string, string>,
    stripe: any,
  ): Promise<void> {
    const customerId = await this.getCustomerByUserId(userId);
    if (!customerId) return;

    await stripe.customers.update(customerId, { metadata });
  }
}
