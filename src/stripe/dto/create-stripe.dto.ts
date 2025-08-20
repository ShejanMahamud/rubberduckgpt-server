import { IsEnum, IsNotEmpty, IsOptional, IsString, IsUrl } from 'class-validator';

export class CreateCheckoutDto {
  @IsEnum(['BASIC', 'PRO'] as any)
  plan: 'BASIC' | 'PRO';

  @IsEnum(['MONTHLY', 'YEARLY'] as any)
  interval: 'MONTHLY' | 'YEARLY';

  @IsUrl()
  @IsNotEmpty()
  successUrl: string;

  @IsUrl()
  @IsNotEmpty()
  cancelUrl: string;

  @IsString()
  @IsOptional()
  priceId?: string; // optional override for testing
}
