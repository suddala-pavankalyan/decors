import { Transform } from 'class-transformer';
import {
  ArrayMaxSize, IsArray, IsIn, IsInt, IsNumber, IsOptional, IsString, Length, Matches, Max, Min,
} from 'class-validator';
import { CATEGORY_SLUGS } from '../products/category';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const cleanTags = ({ value }: { value: unknown }) =>
  Array.isArray(value)
    ? [...new Set(value.map((t) => (typeof t === 'string' ? t.trim().toLowerCase() : t)).filter((t) => t !== ''))]
    : value;

export class ProductInputDto {
  @Transform(trim) @IsString() @Length(1, 120) name: string;
  @IsIn(CATEGORY_SLUGS) category: string;
  @IsInt() @Min(1) @Max(1_000_000) price: number;
  @Transform(trim) @IsString() @Length(1, 2000) description: string;
  @IsNumber({ maxDecimalPlaces: 1 }) @Min(0) @Max(5) rating: number;
  @Transform(trim) @IsString() @Length(1, 40) colorName: string;
  @Matches(/^#[0-9a-fA-F]{6}$/, { message: 'colorHex must look like #RRGGBB' }) colorHex: string;
  @Transform(cleanTags) @IsArray() @ArrayMaxSize(10) @IsString({ each: true }) @Length(1, 30, { each: true }) tags: string[];
}

export class ReorderDto {
  @IsArray() @ArrayMaxSize(20) @IsInt({ each: true }) ids: number[];
}

export class UploadAltDto {
  @IsOptional() @Transform(trim) @IsString() @Length(0, 200) alt?: string;
}
