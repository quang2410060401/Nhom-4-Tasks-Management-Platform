import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsHexColor,
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class GroupStatusInputDto {
  @ApiPropertyOptional({ example: '67f5d5c0d3bdb0f87d1f17e0' })
  @IsOptional()
  @IsMongoId({ message: 'statusId không hợp lệ' })
  _id?: string;

  @ApiProperty({ example: 'In Review' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty({ message: 'Tên status không được để trống' })
  @MaxLength(50)
  name!: string;

  @ApiPropertyOptional({ example: '#6B7280', default: '#6B7280' })
  @IsOptional()
  @IsHexColor({ message: 'Màu phải ở định dạng hex, ví dụ: #FF5733' })
  color?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isCompleted?: boolean;
}
