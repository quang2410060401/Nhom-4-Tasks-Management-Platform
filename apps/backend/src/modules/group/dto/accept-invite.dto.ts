import { IsNotEmpty, IsString, IsUUID, ValidateIf } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AcceptInviteDto {
  @ApiProperty({ description: 'Invite token từ email lời mời' })
  @IsString()
  @IsNotEmpty({ message: 'Token không được để trống' })
  // @IsUUID chỉ kiểm tra khi token không rỗng — tránh trả hai lỗi cho một input
  @ValidateIf(
    (o: AcceptInviteDto) => typeof o.token === 'string' && o.token.length > 0,
  )
  @IsUUID('4', { message: 'Token không hợp lệ' })
  token!: string;
}
