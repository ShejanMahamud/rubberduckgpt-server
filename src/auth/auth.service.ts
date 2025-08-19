import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { User } from 'generated/prisma';
import { PrismaService } from 'src/prisma/prisma.service';
import { Util } from 'src/utils';
import { CreateAuthDto } from './dto/create-auth.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { IJwtPayload } from './types';

@Injectable()
export class AuthService {
  constructor(private prisma: PrismaService, private jwtService: JwtService, private configService: ConfigService) {}

  public async loginOrCreateUser(data: CreateAuthDto) {
    let user = await this.prisma.user.upsert({
      where: { email: data.email ,isActive: true,isDeleted: false},
      update: {},
      create: data,
    });

    const { accessToken, refreshToken } = await this.generateToken(user);

    //save refresh token in db
    const hashedToken = await Util.hash(refreshToken)
    await this.updateUser(user.id, {
      refreshToken: hashedToken,
      refreshTokenExpiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7)
    });
    

    return {
      success: true,
      message: "Google login successful!",
      data: {
        accessToken, refreshToken
      }
    }
  }

  public async validateRefreshTokenAndGenerateNewToken(rToken: string) {
    let decoded: IJwtPayload;
    try {
      decoded = this.jwtService.verify(rToken, {
        secret: this.configService.get('REFRESH_TOKEN_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  
    const user = await this.prisma.user.findUnique({ where: { id: decoded.sub } });
  
    if (!user) throw new NotFoundException('User not found');
    if (user.isDeleted) throw new UnauthorizedException('User is deleted');
    if (!user.isActive) throw new UnauthorizedException('User is not active');
    if (!user.refreshToken) {
      throw new UnauthorizedException('No refresh token found for user');
    }
    const isMatched = await Util.match(user.refreshToken, rToken);
    if (!isMatched) throw new UnauthorizedException('Refresh token does not match');
  
    const { accessToken, refreshToken: newRefreshToken } = await this.generateToken(user);
    const hashedToken = await Util.hash(newRefreshToken);
  
    await this.updateUser(user.id, {
      refreshToken: hashedToken,
      refreshTokenExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });
  
    return {
      success: true,
      message: 'Refresh token is valid',
      data: { accessToken, refreshToken: newRefreshToken },
    };
  }
  

  private async generateToken(user: User) {
    const payload: IJwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    const accessToken = this.jwtService.sign(payload, {
      expiresIn: '1d',
    });
    const refreshToken = this.jwtService.sign(payload, {
      expiresIn: '7d',
    });

    return { accessToken, refreshToken };
  }

  public async updateUser(id: string, data: Partial<UpdateUserDto>) {
    const user = await this.prisma.user.findUnique({ where: { id, isActive: true, isDeleted: false },  });
  
    if (!user) {
      throw new NotFoundException('User not found');
    }
  
    const updatedUser = await this.prisma.user.update({
      where: { id },
      data: {
        ...data, 
      },
    });
  
    return {
      success: true,
      message: 'User updated successfully',
      data: updatedUser,
    };
  }
  

  findAll() {
    return `This action returns all auth`;
  }

  findOne(id: number) {
    return `This action returns a #${id} auth`;
  }

  remove(id: number) {
    return `This action removes a #${id} auth`;
  }
}
