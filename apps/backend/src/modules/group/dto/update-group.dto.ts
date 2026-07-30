import { Transform, Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsDateString,
  IsEmail,
  IsMongoId,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { GroupStatusInputDto } from './group-status-input.dto';
import { GroupLabelInputDto } from './group-label-input.dto';

export class UpdateGroupDto {
  @ApiPropertyOptional({ example: 'Product Design' })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({
    example:
      'Không gian quản lý UI/UX, design system và handoff liên phòng ban.',
    nullable: true,
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => {
    if (typeof value !== 'string') return value;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  })
  @IsString()
  @MaxLength(500)
  description?: string | null;

  @ApiPropertyOptional({
    example: '2026-03-14',
    nullable: true,
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => {
    if (typeof value !== 'string') return value;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  })
  @IsDateString({}, { message: 'Ngày bắt đầu không đúng định dạng' })
  startDate?: string | null;

  @ApiPropertyOptional({
    example: '2026-04-30',
    nullable: true,
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => {
    if (typeof value !== 'string') return value;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  })
  @IsDateString({}, { message: 'Ngày kết thúc không đúng định dạng' })
  endDate?: string | null;

  @ApiPropertyOptional({
    type: () => [GroupStatusInputDto],
    description:
      'Workflow cuối cùng mong muốn của nhóm. Nếu truyền, backend sẽ sync theo payload này.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1, { message: 'Nhóm phải có ít nhất 1 status' })
  @ValidateNested({ each: true })
  @Type(() => GroupStatusInputDto)
  statuses?: GroupStatusInputDto[];

  @ApiPropertyOptional({
    type: () => [GroupLabelInputDto],
    description:
      'Danh sách labels cuối cùng mong muốn của nhóm. Nếu truyền, backend sẽ sync theo payload này.',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GroupLabelInputDto)
  labels?: GroupLabelInputDto[];

  @ApiPropertyOptional({
    type: [String],
    example: ['member@example.com', 'external@example.com'],
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

  @ApiPropertyOptional({
    type: [String],
    example: ['67f5d5c0d3bdb0f87d1f17e0'],
  })
  @IsOptional()
  @IsArray()
  @ArrayUnique({ message: 'Danh sách thành viên cần xóa không được trùng lặp' })
  @IsMongoId({ each: true, message: 'userId không hợp lệ' })
  removeMemberUserIds?: string[];
}
