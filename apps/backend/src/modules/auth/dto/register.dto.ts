import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, Matches } from 'class-validator';
import {
  PASSWORD_RULE,
  PASSWORD_RULE_MESSAGE,
  PASSWORD_SWAGGER_DESCRIPTION,
} from '../auth.constants';

export class RegisterDto {
  @ApiProperty({ example: 'Nguyen Van A', description: 'Họ và tên đầy đủ' })
  @IsString()
  readonly name!: string;

  @ApiProperty({ example: 'user@example.com', description: 'Địa chỉ email' })
  @IsEmail({}, { message: 'Email không đúng định dạng' })
  readonly email!: string;

  @ApiProperty({
    example: 'Secret@1',
    description: PASSWORD_SWAGGER_DESCRIPTION,
    minLength: 6,
    maxLength: 12,
  })
  // Dùng @Matches với PASSWORD_RULE tập trung thay vì @MinLength/@MaxLength riêng lẻ.
  // Quy tắc được định nghĩa trong auth.constants.ts để dễ cập nhật đồng bộ.
  @Matches(PASSWORD_RULE, { message: PASSWORD_RULE_MESSAGE })
  readonly password!: string;
}
