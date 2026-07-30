import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class VerifyEmailQueryDto {
  @ApiProperty({
    description: 'Token xác thực email (được gửi trong email đăng ký)',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsString()
  readonly token!: string;
}
