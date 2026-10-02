import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import type { Request } from 'express';

export const COOKIE = 'decors_token';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService, private readonly prisma: PrismaService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<Request & { userId?: string }>();
    const token = req.cookies?.[COOKIE];
    if (!token) throw new UnauthorizedException();
    let payload: { sub: string; tv?: number };
    try {
      payload = this.jwt.verify<{ sub: string; tv?: number }>(token);
    } catch {
      throw new UnauthorizedException();
    }
    // A token is only good while it matches the account's current tokenVersion (changes on password change),
    // and the account still exists.
    const user = await this.prisma.user.findUnique({ where: { id: payload.sub }, select: { tokenVersion: true } });
    if (!user || (payload.tv ?? 0) !== user.tokenVersion) throw new UnauthorizedException();
    req.userId = payload.sub;
    return true;
  }
}
