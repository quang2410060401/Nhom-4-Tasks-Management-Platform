import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'user@example.com', description: 'Địa chỉ email' })
  @IsEmail({}, { message: 'Email không đúng định dạng' })
  readonly email!: string;

  @ApiProperty({ example: 'Secret@1', description: 'Mật khẩu' })
  @IsString()
  readonly password!: string;
}
