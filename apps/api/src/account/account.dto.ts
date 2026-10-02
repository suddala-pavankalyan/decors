import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsInt, IsString, Max, Min, ValidateNested } from 'class-validator';

export const MAX_QTY = 99;

export class SetQtyDto {
  @IsInt() @Min(0) @Max(MAX_QTY)
  qty: number;
}

export class CartLineDto {
  @IsString() productId: string;
  @IsInt() @Min(1) @Max(MAX_QTY) qty: number;
}

export class MergeDto {
  @IsArray() @ArrayMaxSize(200) @ValidateNested({ each: true }) @Type(() => CartLineDto)
  cart: CartLineDto[];

  @IsArray() @ArrayMaxSize(200) @IsString({ each: true })
  wishlist: string[];
}
