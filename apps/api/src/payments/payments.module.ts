import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { OrdersService } from './orders.service';
import { PaymentsController } from './payments.controller';
import { RazorpayGateway } from './razorpay.gateway';

@Module({
  imports: [AuthModule],
  controllers: [PaymentsController],
  providers: [OrdersService, RazorpayGateway],
})
export class PaymentsModule {}
