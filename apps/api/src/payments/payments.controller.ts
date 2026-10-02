import {
  BadRequestException, Body, Controller, Get, Headers, HttpCode, Param, Post, Req, UnauthorizedException, UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AddressDto, VerifyDto } from './checkout.dto';
import { OrdersService } from './orders.service';
import { RazorpayGateway } from './razorpay.gateway';

type Authed = Request & { userId: string };

@Controller()
export class PaymentsController {
  constructor(private readonly orders: OrdersService, private readonly gateway: RazorpayGateway) {}

  @Post('checkout') @HttpCode(200) @UseGuards(JwtAuthGuard) @Throttle({ default: { limit: 10, ttl: 60_000 } })
  checkout(@Req() req: Authed, @Body() address: AddressDto) {
    return this.orders.checkout(req.userId, address);
  }

  @Post('checkout/verify') @HttpCode(200) @UseGuards(JwtAuthGuard) @Throttle({ default: { limit: 20, ttl: 60_000 } })
  verify(@Req() req: Authed, @Body() dto: VerifyDto) {
    return this.orders.verify(req.userId, dto);
  }

  @Get('orders') @UseGuards(JwtAuthGuard)
  list(@Req() req: Authed) {
    return this.orders.list(req.userId);
  }

  @Get('orders/:id') @UseGuards(JwtAuthGuard)
  one(@Req() req: Authed, @Param('id') id: string) {
    return this.orders.get(req.userId, id);
  }

  /** Razorpay server-to-server notification; authenticated by signature, not by cookie. */
  @Post('webhooks/razorpay') @HttpCode(200)
  async webhook(@Req() req: Request & { rawBody?: Buffer }, @Headers('x-razorpay-signature') signature?: string) {
    if (!req.rawBody || !signature || !this.gateway.verifyWebhook(req.rawBody, signature)) {
      throw new UnauthorizedException('Bad signature');
    }
    const event = JSON.parse(req.rawBody.toString('utf8'));
    if (event.event === 'order.paid' || event.event === 'payment.captured') {
      const pay = event.payload?.payment?.entity;
      if (!pay?.order_id || !pay?.id || typeof pay.amount !== 'number') throw new BadRequestException('Malformed event');
      await this.orders.markPaid(pay.order_id, pay.id, pay.amount);
    }
    return { received: true };
  }
}
