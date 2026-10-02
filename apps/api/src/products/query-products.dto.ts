import { Transform } from 'class-transformer';
import { IsIn, IsNumber, IsOptional, IsString, Min } from 'class-validator';

const csv = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.split(',').filter(Boolean) : value;

export class QueryProductsDto {
  @IsOptional() @IsString() q?: string;
  @IsOptional() @Transform(csv) categories?: string[];
  @IsOptional() @Transform(csv) colors?: string[];
  @IsOptional() @Transform(csv) tags?: string[];
  @IsOptional() @Transform(({ value }) => Number(value)) @IsNumber() @Min(0) minPrice?: number;
  @IsOptional() @Transform(({ value }) => Number(value)) @IsNumber() @Min(0) maxPrice?: number;
  @IsOptional() @IsIn(['price-asc', 'price-desc', 'rating']) sort?: 'price-asc' | 'price-desc' | 'rating';
}
