import {
  BadRequestException, ConflictException, HttpException, HttpStatus, Injectable, Logger, ServiceUnavailableException, UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { MailerService } from '../mail/mailer.service';
import { passwordChangedMessage, resetPasswordMessage, verifyEmailMessage } from '../mail/templates';
import { PrismaService } from '../prisma/prisma.service';
import { TokensService } from './tokens.service';
import { ChangePasswordDto, LoginDto, RegisterDto, UpdateProfileDto } from './auth.dto';

export interface PublicUser {
  id: string;
  email: string;
  name: string;
  role: 'USER' | 'ADMIN';
  createdAt: Date;
  emailVerified: boolean;
}

type UserRow = {
  id: string; email: string; name: string; role: 'USER' | 'ADMIN'; createdAt: Date; tokenVersion: number; emailVerifiedAt: Date | null;
};
const toPublic = (u: UserRow): PublicUser => ({
  id: u.id, email: u.email, name: u.name, role: u.role, createdAt: u.createdAt, emailVerified: !!u.emailVerifiedAt,
});

/** Where email links point: the website, not the API. */
const webUrl = () => (process.env.WEB_ORIGIN ?? 'http://localhost:3000').replace(/\/$/, '');

// Compared against when the email is unknown, so login timing doesn't reveal which emails exist.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 10);

@Injectable()
export class AuthService {
  private readonly log = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly tokens: TokensService,
    private readonly mailer: MailerService,
  ) {}

  async register(dto: RegisterDto): Promise<{ user: PublicUser; token: string }> {
    const passwordHash = await bcrypt.hash(dto.password, 10);
    try {
      const u = await this.prisma.user.create({
        data: { email: dto.email, name: dto.name, passwordHash },
      });
      // Don't make signup wait for (or fail because of) the mail server.
      void this.sendVerificationEmail(u).catch((e) => this.log.error(`Could not send the verification email: ${e?.message}`));
      return this.issue(u);
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('An account with this email already exists');
      }
      throw e;
    }
  }

  async login(dto: LoginDto): Promise<{ user: PublicUser; token: string }> {
    const u = await this.prisma.user.findUnique({ where: { email: dto.email } });
    const ok = await bcrypt.compare(dto.password, u?.passwordHash ?? DUMMY_HASH);
    if (!u || !ok) throw new UnauthorizedException('Invalid email or password');
    return this.issue(u);
  }

  async me(id: string): Promise<PublicUser> {
    const u = await this.prisma.user.findUnique({ where: { id } });
    if (!u) throw new UnauthorizedException();
    return toPublic(u);
  }

  async updateProfile(id: string, dto: UpdateProfileDto): Promise<PublicUser> {
    return toPublic(await this.prisma.user.update({ where: { id }, data: { name: dto.name } }));
  }

  /**
   * Changes the password and signs out every other session (by bumping tokenVersion).
   * Returns a fresh token so the session that made the change stays logged in.
   */
  async changePassword(id: string, dto: ChangePasswordDto): Promise<{ user: PublicUser; token: string }> {
    const u = await this.prisma.user.findUnique({ where: { id } });
    if (!u) throw new UnauthorizedException();
    if (!(await bcrypt.compare(dto.currentPassword, u.passwordHash))) {
      throw new BadRequestException('Your current password is incorrect');
    }
    if (dto.currentPassword === dto.newPassword) {
      throw new BadRequestException('Choose a new password that is different from the current one');
    }
    const updated = await this.prisma.user.update({
      where: { id },
      data: { passwordHash: await bcrypt.hash(dto.newPassword, 10), tokenVersion: { increment: 1 } },
    });
    return this.issue(updated);
  }

  // ───────────── email verification ─────────────

  private async sendVerificationEmail(u: { id: string; email: string; name: string }) {
    const raw = await this.tokens.issue(u.id, 'EMAIL_VERIFY');
    await this.mailer.send(verifyEmailMessage(u.email, u.name, `${webUrl()}/verify-email?token=${raw}`));
  }

  /** Signed-in user asks for a fresh verification email. */
  async resendVerification(userId: string): Promise<{ alreadyVerified: boolean }> {
    const u = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!u) throw new UnauthorizedException();
    if (u.emailVerifiedAt) return { alreadyVerified: true };
    if (await this.tokens.onCooldown(u.id, 'EMAIL_VERIFY')) {
      throw new HttpException('We just sent you an email. Please wait a minute before asking for another.', HttpStatus.TOO_MANY_REQUESTS);
    }
    try {
      await this.sendVerificationEmail(u);
    } catch (e: any) {
      this.log.error(`Could not send the verification email: ${e?.message}`);
      throw new ServiceUnavailableException('We could not send the email right now. Please try again in a few minutes.');
    }
    return { alreadyVerified: false };
  }

  /** The person opened the link in their email and pressed the button. */
  async verifyEmail(raw: string): Promise<{ verified: true }> {
    const t = await this.tokens.find('EMAIL_VERIFY', raw);
    const invalid = new BadRequestException('This link is invalid or has expired. Request a new one from your profile.');
    if (!t) throw invalid;
    if (t.usedAt) {
      // Opening the same link twice is fine once the address is confirmed; a replaced link is not.
      if (t.user.emailVerifiedAt) return { verified: true };
      throw invalid;
    }
    if (t.expiresAt.getTime() < Date.now()) throw invalid;
    await this.prisma.$transaction([
      this.prisma.authToken.update({ where: { id: t.id }, data: { usedAt: new Date() } }),
      this.prisma.user.update({ where: { id: t.userId }, data: { emailVerifiedAt: t.user.emailVerifiedAt ?? new Date() } }),
    ]);
    return { verified: true };
  }

  // ───────────── password reset ─────────────

  /**
   * Always answers the same way, whether or not the address has an account, so this cannot be used to
   * find out who is registered. The real work happens after the response goes out, so timing does not leak either.
   */
  forgotPassword(email: string): { ok: true } {
    void this.sendResetEmail(email).catch((e) => this.log.error(`Could not send the reset email: ${e?.message}`));
    return { ok: true };
  }

  private async sendResetEmail(email: string) {
    const u = await this.prisma.user.findUnique({ where: { email } });
    if (!u) return;
    if (await this.tokens.onCooldown(u.id, 'PASSWORD_RESET')) return; // no email bombing
    const raw = await this.tokens.issue(u.id, 'PASSWORD_RESET');
    await this.mailer.send(resetPasswordMessage(u.email, u.name, `${webUrl()}/reset-password?token=${raw}`));
  }

  async resetPassword(raw: string, newPassword: string): Promise<{ ok: true }> {
    const t = await this.tokens.find('PASSWORD_RESET', raw);
    const invalid = new BadRequestException('This reset link is invalid or has expired. Please request a new one.');
    if (!t || t.usedAt || t.expiresAt.getTime() < Date.now()) throw invalid;
    const passwordHash = await bcrypt.hash(newPassword, 10);
    const now = new Date();
    await this.prisma.$transaction([
      // Single use, and any other outstanding reset links die with it.
      this.prisma.authToken.updateMany({ where: { userId: t.userId, type: 'PASSWORD_RESET', usedAt: null }, data: { usedAt: now } }),
      this.prisma.user.update({
        where: { id: t.userId },
        data: {
          passwordHash,
          tokenVersion: { increment: 1 }, // signs out every device
          emailVerifiedAt: t.user.emailVerifiedAt ?? now, // they proved they own the inbox
        },
      }),
    ]);
    void this.mailer
      .send(passwordChangedMessage(t.user.email, t.user.name, `${webUrl()}/forgot-password`))
      .catch((e) => this.log.error(`Could not send the password-changed notice: ${e?.message}`));
    return { ok: true };
  }

  private issue(u: UserRow) {
    return { user: toPublic(u), token: this.jwt.sign({ sub: u.id, tv: u.tokenVersion }) };
  }
}
