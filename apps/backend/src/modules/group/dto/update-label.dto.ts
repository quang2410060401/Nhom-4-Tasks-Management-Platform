import { Transform } from 'class-transformer';
import { IsHexColor, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateLabelDto {
  @ApiPropertyOptional({ example: 'Feature' })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MaxLength(50)
  name?: string;

  @ApiPropertyOptional({ example: '#10B981' })
  @IsOptional()
  @IsHexColor({ message: 'Màu phải ở định dạng hex, ví dụ: #10B981' })
  color?: string;
}
