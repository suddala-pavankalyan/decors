import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';

export const COOKIE = 'decors_token';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<Request & { userId?: string }>();
    const token = req.cookies?.[COOKIE];
    if (!token) throw new UnauthorizedException();
    try {
      req.userId = this.jwt.verify<{ sub: string }>(token).sub;
      return true;
    } catch {
      throw new UnauthorizedException();
    }
  }
}
