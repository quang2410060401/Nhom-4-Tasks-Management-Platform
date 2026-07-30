import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { TASK_COMMENT_MAX_LENGTH } from '../task.constants';

export class UpdateTaskCommentDto {
  @ApiProperty({ example: 'Đã cập nhật theo feedback mới.' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty({ message: 'Nội dung bình luận không được để trống' })
  @MaxLength(TASK_COMMENT_MAX_LENGTH, {
    message: 'Bình luận tối đa 2000 ký tự',
  })
  content!: string;
}
