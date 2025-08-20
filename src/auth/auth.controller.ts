import { Controller, Delete, Get, HttpCode, HttpStatus, Param, Req, Res, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { GoogleLoginDto } from './dto/create-auth.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}


  @Get()
  findAll() {
    return this.authService.findAll();
  }

  @Get('google')
  @UseGuards(AuthGuard('google'))
  public async googleAuth() {
    // This method initiates Google OAuth flow
  }

  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  @HttpCode(HttpStatus.OK)
  public async googleAuthCallback(@Req() req: Request, @Res() res: Response) {
    const result = await this.authService.loginOrCreateUser(req?.user as GoogleLoginDto);
    const clientOrigin = process.env.CLIENT_ORIGIN || 'http://localhost:3000';
    const url = new URL('/auth/callback', clientOrigin);
    const accessToken = (result as any)?.data?.accessToken || '';
    const refreshToken = (result as any)?.data?.refreshToken || '';
    const fragment = new URLSearchParams({ accessToken, refreshToken }).toString();
    url.hash = fragment; // tokens in URL fragment (not sent to server logs)
    return res.redirect(url.toString());
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.authService.findOne(+id);
  }


  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.authService.remove(+id);
  }
}
