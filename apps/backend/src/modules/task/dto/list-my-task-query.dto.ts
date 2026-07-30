import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsMongoId,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

function transformCsvOrArray(value: unknown) {
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return value;
}

export class ListMyTaskQueryDto {
  @ApiPropertyOptional({ example: 'Đăng nhập' })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MaxLength(200, { message: 'Từ khóa tìm kiếm tối đa 200 ký tự' })
  q?: string;

  @ApiPropertyOptional({
    type: [String],
    example: ['665f1b2c3d4e5f678901ef01'],
    description: 'Danh sách groupId (comma-separated hoặc array)',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => transformCsvOrArray(value))
  @IsArray()
  @IsMongoId({ each: true, message: 'Mỗi groupId phải là ObjectId hợp lệ' })
  @Type(() => String)
  groupIds?: string[];

  @ApiPropertyOptional({
    type: [String],
    example: ['665f1b2c3d4e5f678901ef02'],
    description: 'Danh sách statusId (comma-separated hoặc array)',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => transformCsvOrArray(value))
  @IsArray()
  @IsMongoId({ each: true, message: 'Mỗi statusId phải là ObjectId hợp lệ' })
  @Type(() => String)
  statusIds?: string[];

  @ApiPropertyOptional({
    type: [String],
    example: ['665f1b2c3d4e5f678901ef03'],
    description: 'Danh sách labelId (comma-separated hoặc array)',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => transformCsvOrArray(value))
  @IsArray()
  @IsMongoId({ each: true, message: 'Mỗi labelId phải là ObjectId hợp lệ' })
  @Type(() => String)
  labelIds?: string[];

  @ApiPropertyOptional({ example: '2026-03-01T00:00:00.000Z' })
  @IsOptional()
  @IsDateString({}, { message: 'dateFrom phải là ISO date hợp lệ' })
  dateFrom?: string;

  @ApiPropertyOptional({ example: '2026-03-31T23:59:59.999Z' })
  @IsOptional()
  @IsDateString({}, { message: 'dateTo phải là ISO date hợp lệ' })
  dateTo?: string;
}
