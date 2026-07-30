import { Transform, Type } from 'class-transformer';
import {
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsDateString,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { GroupStatusInputDto } from './group-status-input.dto';
import { GroupLabelInputDto } from './group-label-input.dto';

export class CreateGroupDto {
  @ApiProperty({ example: 'Dự án Website 2025' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty({ message: 'Tên nhóm không được để trống' })
  @MaxLength(100)
  name!: string;

  @ApiPropertyOptional({
    example:
      'Quản lý roadmap, thiết kế, triển khai và vận hành cho website 2025.',
    nullable: true,
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => {
    if (typeof value !== 'string') return value;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  })
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({
    example: '2026-03-14',
    nullable: true,
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => {
    if (typeof value !== 'string') return value;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  })
  @IsDateString({}, { message: 'Ngày bắt đầu không đúng định dạng' })
  startDate?: string;

  @ApiPropertyOptional({
    example: '2026-04-30',
    nullable: true,
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => {
    if (typeof value !== 'string') return value;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  })
  @IsDateString({}, { message: 'Ngày kết thúc không đúng định dạng' })
  endDate?: string;

  @ApiPropertyOptional({
    type: () => [GroupStatusInputDto],
    description:
      'Workflow cuối cùng mong muốn của nhóm. Nếu bỏ trống, backend tự seed mặc định.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1, { message: 'Nhóm phải có ít nhất 1 status' })
  @ValidateNested({ each: true })
  @Type(() => GroupStatusInputDto)
  statuses?: GroupStatusInputDto[];

  @ApiPropertyOptional({
    type: () => [GroupLabelInputDto],
    description: 'Danh sách labels khởi tạo ban đầu cho nhóm.',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GroupLabelInputDto)
  labels?: GroupLabelInputDto[];

  @ApiPropertyOptional({
    type: [String],
    example: ['member@example.com', 'external@example.com'],
    description: 'Danh sách email cần mời sau khi nhóm được tạo.',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => {
    if (!Array.isArray(value)) {
      return value;
    }

    return value.map((item: unknown) =>
      typeof item === 'string' ? item.trim().toLowerCase() : item,
    );
  })
  @IsArray()
  @ArrayUnique({ message: 'Danh sách email mời không được trùng lặp' })
  @IsEmail({}, { each: true, message: 'Email không đúng định dạng' })
  inviteEmails?: string[];
}
