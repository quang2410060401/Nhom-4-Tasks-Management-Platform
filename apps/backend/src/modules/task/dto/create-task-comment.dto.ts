import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { TASK_COMMENT_MAX_LENGTH } from '../task.constants';

export class CreateTaskCommentDto {
  @ApiProperty({ example: 'Cần cập nhật nội dung theo feedback mới nhất.' })
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
