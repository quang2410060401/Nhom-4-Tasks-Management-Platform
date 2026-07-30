import { Type, Transform } from 'class-transformer';
import {
  IsBoolean,
  IsHexColor,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateStatusDto {
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

  @ApiPropertyOptional({
    description: 'Thứ tự cột trên Kanban (tự động tính nếu không truyền)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  order?: number;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isCompleted?: boolean;
}
