import { Body, Controller, Get, HttpCode, Post, Req, Res, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { CookieOptions, Request, Response } from 'express';
import { LoginDto, RegisterDto } from './auth.dto';
import { AuthService } from './auth.service';
import { COOKIE, JwtAuthGuard } from './jwt-auth.guard';

const cookieOptions = (): CookieOptions => ({
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  maxAge: 7 * 24 * 60 * 60 * 1000,
  path: '/',
});

// Brute-force protection: 10 attempts per minute per IP on credential endpoints.
const LIMIT = { default: { limit: 10, ttl: 60_000 } };

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register') @Throttle(LIMIT)
  async register(@Body() dto: RegisterDto, @Res({ passthrough: true }) res: Response) {
    const { user, token } = await this.auth.register(dto);
    res.cookie(COOKIE, token, cookieOptions());
    return user;
  }

  @Post('login') @HttpCode(200) @Throttle(LIMIT)
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const { user, token } = await this.auth.login(dto);
    res.cookie(COOKIE, token, cookieOptions());
    return user;
  }

  @Post('logout') @HttpCode(204)
  logout(@Res({ passthrough: true }) res: Response) {
    const { maxAge, ...rest } = cookieOptions();
    res.clearCookie(COOKIE, rest);
  }

  @Get('me') @UseGuards(JwtAuthGuard)
  me(@Req() req: Request & { userId: string }) {
    return this.auth.me(req.userId);
  }
}
