import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
} from 'class-validator';

export class UpdateProfileDto {
  @ApiPropertyOptional({
    description: 'Tên hiển thị của người dùng',
    example: 'Nguyen Van A',
    minLength: 1,
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MinLength(1, { message: 'Tên không được để trống' })
  @MaxLength(100, { message: 'Tên không được quá 100 ký tự' })
  name?: string;

  @ApiPropertyOptional({
    description: 'URL avatar của người dùng (null để xóa avatar)',
    example: 'https://example.com/avatar.jpg',
    nullable: true,
  })
  @IsOptional()
  @IsUrl({}, { message: 'Avatar phải là URL hợp lệ' })
  avatar?: string | null;
}
