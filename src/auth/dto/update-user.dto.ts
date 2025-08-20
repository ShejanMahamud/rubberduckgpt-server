import { PartialType } from '@nestjs/mapped-types';
import { IsBoolean, IsDate, IsEnum, IsOptional, IsString } from 'class-validator';
import { Role } from 'generated/prisma';
import { GoogleLoginDto } from './create-auth.dto';

export class UpdateUserDto extends PartialType(GoogleLoginDto) {
    @IsEnum(Role)
    @IsOptional()
    role: Role;

    @IsBoolean()
    @IsOptional()
    isActive: boolean;

    @IsBoolean()
    @IsOptional()
    isDeleted: boolean;

    @IsBoolean()
    @IsOptional()
    isPremium: boolean;

    @IsString()
    @IsOptional()
    refreshToken: string

    @IsDate()
    @IsOptional()
    refreshTokenExpiresAt: Date

    @IsString()
    @IsOptional()
    accessToken: string

    @IsDate()
    @IsOptional()
    accessTokenExpiresAt: Date
}

