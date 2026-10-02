import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { MergeDto, SetQtyDto } from './account.dto';
import { AccountService } from './account.service';

type Authed = Request & { userId: string };

@Controller('account')
@UseGuards(JwtAuthGuard)
export class AccountController {
  constructor(private readonly account: AccountService) {}

  @Get('state')
  state(@Req() req: Authed) {
    return this.account.state(req.userId);
  }

  @Post('merge') @HttpCode(200)
  merge(@Req() req: Authed, @Body() dto: MergeDto) {
    return this.account.merge(req.userId, dto);
  }

  @Put('cart/:productId') @HttpCode(204)
  async setQty(@Req() req: Authed, @Param('productId') id: string, @Body() dto: SetQtyDto) {
    await this.account.setQty(req.userId, id, dto.qty);
  }

  @Delete('cart') @HttpCode(204)
  async clearCart(@Req() req: Authed) {
    await this.account.clearCart(req.userId);
  }

  @Put('wishlist/:productId') @HttpCode(204)
  async addWish(@Req() req: Authed, @Param('productId') id: string) {
    await this.account.addWish(req.userId, id);
  }

  @Delete('wishlist/:productId') @HttpCode(204)
  async removeWish(@Req() req: Authed, @Param('productId') id: string) {
    await this.account.removeWish(req.userId, id);
  }
}
