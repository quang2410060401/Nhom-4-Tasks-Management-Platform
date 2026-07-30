import { Transform } from 'class-transformer';
import {
  IsHexColor,
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class GroupLabelInputDto {
  @ApiPropertyOptional({ example: '67f5d5c0d3bdb0f87d1f17e0' })
  @IsOptional()
  @IsMongoId({ message: 'labelId không hợp lệ' })
  _id?: string;

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
