import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto, RegisterDto } from './auth.dto';

export interface PublicUser {
  id: string;
  email: string;
  name: string;
}

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
    return { id: u.id, email: u.email, name: u.name };
  }

  private issue(u: { id: string; email: string; name: string }) {
    return {
      user: { id: u.id, email: u.email, name: u.name },
      token: this.jwt.sign({ sub: u.id }),
    };
  }
}
