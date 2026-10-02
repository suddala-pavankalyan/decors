import { Transform } from 'class-transformer';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

const trimLower = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

export class RegisterDto {
  @IsString() @MinLength(1) @MaxLength(80) @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  name: string;

  @IsEmail() @MaxLength(254) @Transform(trimLower)
  email: string;

  // bcrypt only uses the first 72 bytes, so cap the length rather than silently truncating.
  @IsString() @MinLength(8) @MaxLength(72)
  password: string;
}

export class LoginDto {
  @IsEmail() @Transform(trimLower)
  email: string;

  @IsString() @MaxLength(72)
  password: string;
}
