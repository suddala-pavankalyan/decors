import { BadGatewayException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';
import Razorpay from 'razorpay';

const hmac = (secret: string, data: string | Buffer) => createHmac('sha256', secret).update(data).digest('hex');

function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** Thin wrapper around Razorpay so the rest of the app (and tests) never touch the SDK or secrets directly. */
@Injectable()
export class RazorpayGateway {
  private readonly log = new Logger(RazorpayGateway.name);
  private client?: Razorpay;

  private env(name: 'RAZORPAY_KEY_ID' | 'RAZORPAY_KEY_SECRET' | 'RAZORPAY_WEBHOOK_SECRET'): string {
    const v = process.env[name];
    if (!v) throw new ServiceUnavailableException('Payments are not configured');
    return v;
  }

  get keyId(): string {
    return this.env('RAZORPAY_KEY_ID');
  }

  async createOrder(amountPaise: number, receipt: string): Promise<{ id: string }> {
    this.client ??= new Razorpay({ key_id: this.keyId, key_secret: this.env('RAZORPAY_KEY_SECRET') });
    try {
      return await this.client.orders.create({ amount: amountPaise, currency: 'INR', receipt });
    } catch (e: any) {
      // Razorpay errors carry a description; log it without echoing credentials.
      this.log.error(`Razorpay order creation failed: ${e?.error?.description ?? e?.message ?? 'unknown'}`);
      throw new BadGatewayException('Could not start the payment. Please try again.');
    }
  }

  /** Checkout success callback: signature = HMAC_SHA256(order_id + "|" + payment_id, key_secret). */
  verifyPayment(razorpayOrderId: string, paymentId: string, signature: string): boolean {
    return safeEqual(hmac(this.env('RAZORPAY_KEY_SECRET'), `${razorpayOrderId}|${paymentId}`), signature);
  }

  /** Webhook: X-Razorpay-Signature = HMAC_SHA256(raw request body, webhook_secret). */
  verifyWebhook(rawBody: Buffer, signature: string): boolean {
    return safeEqual(hmac(this.env('RAZORPAY_WEBHOOK_SECRET'), rawBody), signature);
  }
}
