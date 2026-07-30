import { Transform, Type } from 'class-transformer';
import {
  IsDateString,
  IsArray,
  IsMongoId,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO cho query params khi lấy danh sách tasks (Kanban view).
 * Endpoint: GET /groups/:groupId/tasks
 *
 * Tất cả filters đều tuỳ chọn.
 * Kết quả trả về được group theo status (Kanban layout).
 */
export class ListTaskQueryDto {
  /**
   * Lọc theo người được giao.
   * Ví dụ: ?assigneeId=665f1b2c3d4e5f678901ef01
   */
  @ApiPropertyOptional({ example: '665f1b2c3d4e5f678901ef01' })
  @IsOptional()
  @IsMongoId({ message: 'assigneeId phải là ObjectId hợp lệ' })
  assigneeId?: string;

  /**
   * Lọc theo nhiều người được giao.
   * Ví dụ: ?assigneeIds=id1,id2 hoặc ?assigneeIds[]=id1&assigneeIds[]=id2
   */
  @ApiPropertyOptional({
    type: [String],
    example: ['665f1b2c3d4e5f678901ef01', '665f1b2c3d4e5f678901ef02'],
    description: 'Danh sách assigneeId (comma-separated hoặc array)',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => {
    if (typeof value === 'string') return value.split(',').map((v) => v.trim());
    return value;
  })
  @IsArray()
  @IsMongoId({ each: true, message: 'Mỗi assigneeId phải là ObjectId hợp lệ' })
  @Type(() => String)
  assigneeIds?: string[];

  /**
   * Lọc theo một hoặc nhiều labels (comma-separated hoặc array).
   * Ví dụ: ?labelIds=id1,id2  hoặc ?labelIds[]=id1&labelIds[]=id2
   * Task phải có ít nhất một trong các labels được lọc.
   */
  @ApiPropertyOptional({
    type: [String],
    example: ['665f1b2c3d4e5f678901aaaa'],
    description: 'Danh sách labelId (comma-separated hoặc array)',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => {
    // Hỗ trợ cả dạng "id1,id2" và array từ query string
    if (typeof value === 'string') return value.split(',').map((v) => v.trim());
    return value;
  })
  @IsArray()
  @IsMongoId({ each: true, message: 'Mỗi labelId phải là ObjectId hợp lệ' })
  @Type(() => String)
  labelIds?: string[];

  @ApiPropertyOptional({
    type: [String],
    example: ['665f1b2c3d4e5f678901bbbb'],
    description: 'Danh sách statusId (comma-separated hoặc array)',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => {
    if (typeof value === 'string') return value.split(',').map((v) => v.trim());
    return value;
  })
  @IsArray()
  @IsMongoId({ each: true, message: 'Mỗi statusId phải là ObjectId hợp lệ' })
  @Type(() => String)
  statusIds?: string[];

  @ApiPropertyOptional({ example: '2026-03-01T00:00:00.000Z' })
  @IsOptional()
  @IsDateString({}, { message: 'dateFrom phải là ISO date hợp lệ' })
  dateFrom?: string;

  @ApiPropertyOptional({ example: '2026-03-31T23:59:59.999Z' })
  @IsOptional()
  @IsDateString({}, { message: 'dateTo phải là ISO date hợp lệ' })
  dateTo?: string;

  /**
   * Tìm kiếm theo title (case-insensitive, partial match).
   * Ví dụ: ?search=thiết kế
   */
  @ApiPropertyOptional({ example: 'thiết kế' })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MaxLength(200, { message: 'Từ khóa tìm kiếm tối đa 200 ký tự' })
  search?: string;
}
