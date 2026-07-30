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
  ValidateIf,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO dùng khi cập nhật task (partial update).
 * Endpoint: PATCH /groups/:groupId/tasks/:taskId
 *
 * Tất cả các trường đều tuỳ chọn.
 * Service chỉ validate các trường được truyền vào.
 */
export class UpdateTaskDto {
  @ApiPropertyOptional({ example: 'Cập nhật thiết kế giao diện Kanban' })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty({ message: 'Tiêu đề không được để trống' })
  @MaxLength(200, { message: 'Tiêu đề tối đa 200 ký tự' })
  title?: string;

  @ApiPropertyOptional({ example: 'Cập nhật theo feedback sprint 3' })
  @IsOptional()
  @IsString()
  @MaxLength(20000, { message: 'Mô tả tối đa 20000 ký tự HTML' })
  description?: string;

  /**
   * StatusId mới — phải thuộc cùng groupId, validate ở tầng service.
   * Khi chuyển sang status completed/incomplete, service cần reset notification flags.
   */
  @ApiPropertyOptional({ example: '665f1b2c3d4e5f678901abcd' })
  @IsOptional()
  @IsMongoId({ message: 'statusId phải là ObjectId hợp lệ' })
  statusId?: string;

  /**
   * assigneeId mới hoặc null để bỏ giao việc.
   * null được chấp nhận — dùng @ValidateIf để chỉ validate khi không null.
   */
  @ApiPropertyOptional({
    example: '665f1b2c3d4e5f678901ef01',
    nullable: true,
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsMongoId({ message: 'assigneeId phải là ObjectId hợp lệ' })
  assigneeId?: string | null;

  /**
   * deadline mới hoặc null để xóa deadline.
   * Nếu truyền giá trị (không null), service validate > now.
   * Khi thay đổi deadline trên task chưa hoàn thành, reset notification flags.
   */
  @ApiPropertyOptional({
    example: '2025-12-31T23:59:00.000Z',
    nullable: true,
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsDateString({}, { message: 'deadline phải là ISO 8601 datetime hợp lệ' })
  deadline?: string | null;

  /**
   * Danh sách labelIds mới — thay thế toàn bộ labels hiện tại của task.
   * Service xóa task_labels cũ và insert mới.
   */
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
