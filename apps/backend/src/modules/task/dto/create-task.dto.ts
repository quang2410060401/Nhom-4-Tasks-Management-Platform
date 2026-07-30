import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO dùng khi tạo task mới.
 * Endpoint: POST /groups/:groupId/tasks
 *
 * Các trường không có mặt ở đây (groupId, creatorId) sẽ được
 * service tự động inject từ route param và JWT payload.
 */
export class CreateTaskDto {
  @ApiProperty({ example: 'Thiết kế giao diện Kanban' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty({ message: 'Tiêu đề không được để trống' })
  @MaxLength(200, { message: 'Tiêu đề tối đa 200 ký tự' })
  title!: string;

  @ApiPropertyOptional({ example: 'Thiết kế theo mockup Figma đã được duyệt' })
  @IsOptional()
  @IsString()
  @MaxLength(20000, { message: 'Mô tả tối đa 20000 ký tự HTML' })
  description?: string;

  /**
   * StatusId phải thuộc cùng groupId — validate thêm ở tầng service.
   * Nếu không truyền, service sẽ dùng status có isDefault = true của group.
   */
  @ApiPropertyOptional({ example: '665f1b2c3d4e5f678901abcd' })
  @IsOptional()
  @IsMongoId({ message: 'statusId phải là ObjectId hợp lệ' })
  statusId?: string;

  /**
   * assigneeId phải là member của group — validate ở tầng service.
   */
  @ApiPropertyOptional({ example: '665f1b2c3d4e5f678901ef01' })
  @IsOptional()
  @IsMongoId({ message: 'assigneeId phải là ObjectId hợp lệ' })
  assigneeId?: string;

  /**
   * Hạn hoàn thành — phải là ISO 8601 datetime và > now (validate ở service).
   * Ví dụ: "2025-12-31T23:59:00.000Z"
   */
  @ApiPropertyOptional({ example: '2025-12-31T23:59:00.000Z' })
  @IsOptional()
  @IsDateString({}, { message: 'deadline phải là ISO 8601 datetime hợp lệ' })
  deadline?: string;

  /** Danh sách labelIds — phải thuộc cùng group (validate ở service). */
  @ApiPropertyOptional({
    type: [String],
    example: ['665f1b2c3d4e5f678901aaaa'],
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20, { message: 'Tối đa 20 labels mỗi task' })
  @IsMongoId({ each: true, message: 'Mỗi labelId phải là ObjectId hợp lệ' })
  @Type(() => String)
  labelIds?: string[];
}
