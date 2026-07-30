import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { GroupRole } from '../enums/group-role.enum';

export class UpdateMemberRoleDto {
  @ApiProperty({
    example: GroupRole.ADMIN,
    enum: [GroupRole.ADMIN, GroupRole.MEMBER],
  })
  @IsEnum([GroupRole.ADMIN, GroupRole.MEMBER], {
    message: 'Vai trò thành viên không hợp lệ',
  })
  role!: GroupRole;
}
