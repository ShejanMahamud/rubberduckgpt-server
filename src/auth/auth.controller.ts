import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthGuard } from '@nestjs/passport';
import { Throttle } from '@nestjs/throttler';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { GoogleLoginDto } from './dto/create-auth.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService,
  ) {}

  @Get()
  findAll() {
    return this.authService.findAll();
  }

  @Get('google')
  @UseGuards(AuthGuard('google'))
  public googleAuth(@Req() req: Request, @Res() res: Response) {
    if (req.user) {
      return res.redirect(`${this.config.get('FRONTEND_URL')}/dashboard`);
    }
  }

  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  @HttpCode(HttpStatus.OK)
  @Throttle({ short: { limit: 3, ttl: 60000 } })
  public async googleAuthCallback(@Req() req: Request, @Res() res: Response) {
    const { data } = await this.authService.loginOrCreateUser(
      req?.user as GoogleLoginDto,
    );
    return res.redirect(
      `${this.config.get('FRONTEND_URL')}/auth/callback?accessToken=${data?.accessToken}&refreshToken=${data?.refreshToken}`,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  public async me(@Req() req: Request) {
    return this.authService.me(req);
  }

  @Post('refresh')
  public async refresh(@Body() body: { rToken: string }) {
    return this.authService.validateRefreshTokenAndGenerateNewToken(
      body?.rToken,
    );
  }
}
