import {
  Body,
  Controller,
  Get,
  Headers,
  Post,
  RawBodyRequest,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { CreateCheckoutDto } from './dto/create-stripe.dto';
import { StripeService } from './stripe.service';

@Controller('stripe')
export class StripeController {
  constructor(private readonly stripeService: StripeService) {}

  @Post('checkout')
  @UseGuards(JwtAuthGuard)
  async checkout(@Body() body: CreateCheckoutDto, @Req() req: Request) {
    // require auth in real flow; assuming user on request via JwtAuthGuard in router
    const user = (req as any).user || { sub: '', email: '' };
    return this.stripeService.createCheckoutSession(user.sub, user.email, body);
  }

  @Post('webhook')
  async webhook(
    @Headers('stripe-signature') signature: string,
    @Req() req: RawBodyRequest<Request>,
  ) {
    const raw = (req as any).body as Buffer;
    return this.stripeService.handleWebhook(signature, raw);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@Req() req: Request) {
    const user = (req as any).user || { sub: '' };
    return this.stripeService.getSubscriptionStatus(user.sub);
  }

  @Post('refresh')
  @UseGuards(JwtAuthGuard)
  async refresh(@Req() req: Request) {
    const user = (req as any).user || { sub: '' };
    return this.stripeService.refreshSubscriptionStatus(user.sub);
  }
}
