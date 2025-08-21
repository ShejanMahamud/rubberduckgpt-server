import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateCheckoutDto {
  @IsEnum(['BASIC', 'PRO'] as any)
  plan: 'BASIC' | 'PRO';

  @IsEnum(['MONTHLY', 'YEARLY'] as any)
  interval: 'MONTHLY' | 'YEARLY';

  @IsString()
  @IsNotEmpty()
  successUrl: string;

  @IsString()
  @IsNotEmpty()
  cancelUrl: string;

  @IsString()
  @IsOptional()
  priceId?: string; // optional override for testing
}
