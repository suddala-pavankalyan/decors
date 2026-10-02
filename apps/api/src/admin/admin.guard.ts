import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/** Use after JwtAuthGuard. Reads the role from the database on every request, so demoting an admin takes effect at once. */
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<{ userId?: string }>();
    const user = req.userId
      ? await this.prisma.user.findUnique({ where: { id: req.userId }, select: { role: true } })
      : null;
    if (user?.role !== 'ADMIN') throw new ForbiddenException('Admin access required');
    return true;
  }
}
