import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { GroupRole } from '../enums/group-role.enum';

export class InviteMemberDto {
  @ApiProperty({ example: 'member@example.com' })
  // Chuẩn hoá email để khớp với giá trị được lưu trong database (lowercase + trim)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.toLowerCase().trim() : value,
  )
  @IsString()
  @IsEmail({}, { message: 'Email không đúng định dạng' })
  @IsNotEmpty({ message: 'Email không được để trống' })
  email!: string;

  @ApiProperty({
    example: GroupRole.MEMBER,
    enum: [GroupRole.ADMIN, GroupRole.MEMBER],
    required: false,
  })
  @IsOptional()
  @IsEnum([GroupRole.ADMIN, GroupRole.MEMBER], {
    message: 'Vai trò lời mời không hợp lệ',
  })
  role?: GroupRole;
}
