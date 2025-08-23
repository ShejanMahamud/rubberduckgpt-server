import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('No valid authorization token provided');
    }

    const token = authHeader.substring(7);

    try {
      // Find user by access token
      const user = await this.prisma.user.findFirst({
        where: { accessToken: token },
      });

      if (!user) {
        throw new UnauthorizedException('Invalid token');
      }

      if (user.role !== 'ADMIN') {
        throw new UnauthorizedException('Admin access required');
      }

      // Add user to request for use in controllers
      (request as any).user = user;

      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException('Authentication failed');
    }
  }
}
