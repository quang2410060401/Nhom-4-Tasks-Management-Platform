import { Transform } from 'class-transformer';
import {
  IsHexColor,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateLabelDto {
  @ApiProperty({ example: 'Bug' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty({ message: 'Tên nhãn không được để trống' })
  @MaxLength(50)
  name!: string;

  @ApiPropertyOptional({ example: '#EF4444', default: '#6B7280' })
  @IsOptional()
  @IsHexColor({ message: 'Màu phải ở định dạng hex, ví dụ: #EF4444' })
  color?: string;
}
