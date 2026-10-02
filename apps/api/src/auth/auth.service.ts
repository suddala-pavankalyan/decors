import { BadRequestException, ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { ChangePasswordDto, LoginDto, RegisterDto, UpdateProfileDto } from './auth.dto';

export interface PublicUser {
  id: string;
  email: string;
  name: string;
  role: 'USER' | 'ADMIN';
  createdAt: Date;
}

type UserRow = { id: string; email: string; name: string; role: 'USER' | 'ADMIN'; createdAt: Date; tokenVersion: number };
const toPublic = (u: UserRow): PublicUser => ({ id: u.id, email: u.email, name: u.name, role: u.role, createdAt: u.createdAt });

// Compared against when the email is unknown, so login timing doesn't reveal which emails exist.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 10);

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService, private readonly jwt: JwtService) {}

  async register(dto: RegisterDto): Promise<{ user: PublicUser; token: string }> {
    const passwordHash = await bcrypt.hash(dto.password, 10);
    try {
      const u = await this.prisma.user.create({
        data: { email: dto.email, name: dto.name, passwordHash },
      });
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

  private issue(u: UserRow) {
    return { user: toPublic(u), token: this.jwt.sign({ sub: u.id, tv: u.tokenVersion }) };
  }
}
