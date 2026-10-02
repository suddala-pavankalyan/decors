import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AddressDto } from './checkout.dto';
import { RazorpayGateway } from './razorpay.gateway';

const orderInclude = { items: true } satisfies Prisma.OrderInclude;

@Injectable()
export class OrdersService {
  constructor(private readonly prisma: PrismaService, private readonly gateway: RazorpayGateway) {}

  /** Build an order from the user's saved cart, priced from the database (never from the client). */
  async checkout(userId: string, addr: AddressDto) {
    const cart = await this.prisma.cartItem.findMany({ where: { userId }, include: { product: true } });
    if (cart.length === 0) throw new BadRequestException('Your cart is empty');

    const items = cart.map((c) => ({
      productId: c.productId, name: c.product.name, unitPricePaise: c.product.price * 100, qty: c.qty,
    }));
    const amount = items.reduce((n, i) => n + i.unitPricePaise * i.qty, 0);

    const order = await this.prisma.order.create({
      data: {
        userId, amount,
        shipName: addr.name, shipPhone: addr.phone, shipLine1: addr.line1, shipLine2: addr.line2 || null,
        shipCity: addr.city, shipState: addr.state, shipPincode: addr.pincode,
        items: { create: items },
      },
    });

    const rzp = await this.gateway.createOrder(amount, order.id);
    await this.prisma.order.update({ where: { id: order.id }, data: { razorpayOrderId: rzp.id } });
    return { orderId: order.id, razorpayOrderId: rzp.id, amount, currency: 'INR', keyId: this.gateway.keyId };
  }

  /** Called from the browser after Razorpay reports success. */
  async verify(userId: string, p: { orderId: string; razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) {
    const order = await this.prisma.order.findFirst({ where: { id: p.orderId, userId } });
    if (!order || order.razorpayOrderId !== p.razorpay_order_id) throw new NotFoundException('Order not found');
    if (!this.gateway.verifyPayment(p.razorpay_order_id, p.razorpay_payment_id, p.razorpay_signature)) {
      throw new BadRequestException('Payment verification failed');
    }
    await this.markPaid(order.razorpayOrderId!, p.razorpay_payment_id, order.amount);
    return this.get(userId, order.id);
  }

  /**
   * Idempotent: the browser callback and the webhook may both report the same payment.
   * The amount must match what we asked Razorpay to collect.
   */
  async markPaid(razorpayOrderId: string, paymentId: string, paidAmount: number): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({ where: { razorpayOrderId }, include: { items: true } });
      if (!order || order.status === 'PAID' || order.amount !== paidAmount) return;
      await tx.order.update({
        where: { id: order.id },
        data: { status: 'PAID', razorpayPaymentId: paymentId, paidAt: new Date() },
      });
      // Remove what was bought from the cart; anything added since checkout started stays.
      await tx.cartItem.deleteMany({
        where: { userId: order.userId, productId: { in: order.items.flatMap((i) => (i.productId ? [i.productId] : [])) } },
      });
    });
  }

  list(userId: string) {
    return this.prisma.order.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, include: orderInclude });
  }

  async get(userId: string, id: string) {
    const order = await this.prisma.order.findFirst({ where: { id, userId }, include: orderInclude });
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }
}
