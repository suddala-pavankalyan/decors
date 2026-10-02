import { Injectable } from '@nestjs/common';
import { AuthTokenType } from '@prisma/client';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

export const hashToken = (raw: string) => createHash('sha256').update(raw).digest('hex');

export const TTL = {
  EMAIL_VERIFY: 24 * 60 * 60 * 1000,
  PASSWORD_RESET: 60 * 60 * 1000,
} as const;

/** How soon a new email of the same kind may be requested for one account. */
export const RESEND_COOLDOWN_MS = 60 * 1000;

@Injectable()
export class TokensService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Creates a one-time token and returns the raw value to put in the email link.
   * Only its SHA-256 hash is stored, and any earlier unused token of the same kind stops working.
   */
  async issue(userId: string, type: AuthTokenType): Promise<string> {
    const raw = randomBytes(32).toString('base64url');
    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.authToken.updateMany({ where: { userId, type, usedAt: null }, data: { usedAt: now } }),
      // housekeeping: drop this person's old, expired tokens
      this.prisma.authToken.deleteMany({ where: { userId, expiresAt: { lt: new Date(now.getTime() - 24 * 60 * 60 * 1000) } } }),
      this.prisma.authToken.create({
        data: { userId, type, tokenHash: hashToken(raw), expiresAt: new Date(now.getTime() + TTL[type]) },
      }),
    ]);
    return raw;
  }

  /** True when a token of this kind was issued for the account less than a minute ago. */
  async onCooldown(userId: string, type: AuthTokenType): Promise<boolean> {
    const last = await this.prisma.authToken.findFirst({ where: { userId, type }, orderBy: { createdAt: 'desc' }, select: { createdAt: true } });
    return !!last && Date.now() - last.createdAt.getTime() < RESEND_COOLDOWN_MS;
  }

  find(type: AuthTokenType, raw: string) {
    return this.prisma.authToken.findUnique({ where: { tokenHash: hashToken(raw) }, include: { user: true } }).then((t) => (t && t.type === type ? t : null));
  }
}
