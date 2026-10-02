import { Transform } from 'class-transformer';
import { IsOptional, IsString, Length, Matches } from 'class-validator';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class AddressDto {
  @Transform(trim) @IsString() @Length(1, 80) name: string;
  @Transform(trim) @Matches(/^[6-9]\d{9}$/, { message: 'phone must be a 10-digit Indian mobile number' }) phone: string;
  @Transform(trim) @IsString() @Length(1, 120) line1: string;
  @Transform(trim) @IsOptional() @IsString() @Length(0, 120) line2?: string;
  @Transform(trim) @IsString() @Length(1, 60) city: string;
  @Transform(trim) @IsString() @Length(1, 60) state: string;
  @Transform(trim) @Matches(/^[1-9]\d{5}$/, { message: 'pincode must be 6 digits' }) pincode: string;
}

export class VerifyDto {
  @IsString() orderId: string;
  @IsString() razorpay_order_id: string;
  @IsString() razorpay_payment_id: string;
  @IsString() razorpay_signature: string;
}
