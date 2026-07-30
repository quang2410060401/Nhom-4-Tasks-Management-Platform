import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { LoginResult, RegisterResult, UserProfileResult } from './auth.types';
import { AuthService } from './auth.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { VerifyEmailQueryDto } from './dto/verify-email-query.dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // ---------------------------------------------------------------------------
  // POST /api/auth/register
  // ---------------------------------------------------------------------------

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Đăng ký tài khoản mới',
    description:
      'Tạo tài khoản với email/password. Hệ thống gửi email xác thực sau khi đăng ký thành công.',
  })
  @ApiBody({ type: RegisterDto })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Đăng ký thành công — email xác thực đã được gửi.',
    schema: {
      example: {
        statusCode: 201,
        message: 'Vui lòng kiểm tra email để xác nhận',
        data: { userId: '507f1f77bcf86cd799439011' },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Email đã tồn tại hoặc dữ liệu đầu vào không hợp lệ.',
  })
  async register(
    @Body() dto: RegisterDto,
  ): Promise<{ statusCode: number; message: string; data: RegisterResult }> {
    const data = await this.authService.register(dto);
    return {
      statusCode: HttpStatus.CREATED,
      message: 'Vui lòng kiểm tra email để xác nhận',
      data,
    };
  }

  // ---------------------------------------------------------------------------
  // GET /api/auth/verify-email
  // ---------------------------------------------------------------------------

  @Get('verify-email')
  @ApiOperation({ summary: 'Xác thực email qua token' })
  @ApiQuery({
    name: 'token',
    required: true,
    description: 'Token xác thực email (UUID)',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Xác thực thành công.',
    schema: {
      example: { statusCode: 200, message: 'Email xác nhận thành công' },
    },
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Token không hợp lệ hoặc đã hết hạn.',
  })
  async verifyEmail(
    @Query() query: VerifyEmailQueryDto,
  ): Promise<{ statusCode: number; message: string }> {
    await this.authService.verifyEmail(query.token);
    return { statusCode: HttpStatus.OK, message: 'Email xác nhận thành công' };
  }

  // ---------------------------------------------------------------------------
  // POST /api/auth/login
  // ---------------------------------------------------------------------------

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Đăng nhập bằng email/password',
    description: 'Trả về JWT access token khi đăng nhập thành công.',
  })
  @ApiBody({ type: LoginDto })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Đăng nhập thành công — trả về access token.',
    schema: {
      example: {
        statusCode: 200,
        message: 'Đăng nhập thành công',
        data: {
          accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
          user: {
            _id: '507f1f77bcf86cd799439011',
            name: 'Nguyen Van A',
            email: 'user@example.com',
            avatar: null,
          },
        },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Dữ liệu đầu vào không hợp lệ.',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Sai email hoặc mật khẩu.',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Email chưa được xác thực.',
  })
  async login(
    @Body() dto: LoginDto,
  ): Promise<{ statusCode: number; message: string; data: LoginResult }> {
    const data = await this.authService.login(dto);
    return {
      statusCode: HttpStatus.OK,
      message: 'Đăng nhập thành công',
      data,
    };
  }

  // TODO: POST /auth/google — Google login via Firebase ID token
  // @Post('google')
  // @HttpCode(HttpStatus.OK)
  // @ApiOperation({ summary: 'Login with Google Firebase ID token' })
  // async googleLogin(@Body() dto: GoogleLoginDto): Promise<...> { ... }

  // ---------------------------------------------------------------------------
  // GET /api/auth/me
  // ---------------------------------------------------------------------------

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Lấy thông tin user hiện tại' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Trả về thông tin profile của user đang đăng nhập.',
    schema: {
      example: {
        statusCode: 200,
        data: {
          _id: '507f1f77bcf86cd799439011',
          name: 'Nguyen Van A',
          email: 'user@example.com',
          avatar: null,
          isEmailVerified: true,
        },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Chưa xác thực.',
  })
  async getProfile(
    @CurrentUser() user: { sub: string; email: string },
  ): Promise<{ statusCode: number; data: UserProfileResult }> {
    // False-positive: tsc and CLI ESLint report 0 errors. VS Code language
    // server incorrectly infers "error type" from Mongoose generic chains.

    const data = await this.authService.getProfile(user.sub);

    return { statusCode: HttpStatus.OK, data };
  }

  // ---------------------------------------------------------------------------
  // PATCH /api/auth/me
  // ---------------------------------------------------------------------------

  @Patch('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Cập nhật profile',
    description:
      'Cập nhật tên và/hoặc avatar của user hiện tại. Chỉ truyền các field muốn thay đổi.',
  })
  @ApiBody({ type: UpdateProfileDto })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Cập nhật thành công — trả về profile mới nhất.',
    schema: {
      example: {
        statusCode: 200,
        message: 'Cập nhật profile thành công',
        data: {
          _id: '507f1f77bcf86cd799439011',
          name: 'Nguyen Van B',
          email: 'user@example.com',
          avatar: 'https://example.com/avatar.jpg',
          isEmailVerified: true,
        },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Avatar không phải URL hợp lệ hoặc tên vượt quá 100 ký tự.',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Token không hợp lệ hoặc hết hạn.',
  })
  async updateProfile(
    @CurrentUser() user: { sub: string; email: string },
    @Body() dto: UpdateProfileDto,
  ): Promise<{ statusCode: number; message: string; data: UserProfileResult }> {
    // False-positive: same Mongoose generic type issue — tsc and CLI ESLint pass.

    const data = await this.authService.updateProfile(user.sub, dto);
    return {
      statusCode: HttpStatus.OK,
      message: 'Cập nhật profile thành công',

      data,
    };
  }

  // ---------------------------------------------------------------------------
  // POST /api/auth/change-password
  // ---------------------------------------------------------------------------

  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Đổi mật khẩu',
    description:
      'Yêu cầu mật khẩu hiện tại để xác minh danh tính trước khi đặt mật khẩu mới.',
  })
  @ApiBody({ type: ChangePasswordDto })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Đổi mật khẩu thành công.',
    schema: {
      example: {
        statusCode: 200,
        message: 'Đổi mật khẩu thành công',
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Mật khẩu hiện tại không đúng.',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description:
      'Mật khẩu mới trùng mật khẩu cũ, quá ngắn, hoặc tài khoản không dùng email/password.',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Người dùng không tồn tại.',
  })
  async changePassword(
    @CurrentUser() user: { sub: string; email: string },
    @Body() dto: ChangePasswordDto,
  ): Promise<{ statusCode: number; message: string }> {
    await this.authService.changePassword(user.sub, dto);
    return { statusCode: HttpStatus.OK, message: 'Đổi mật khẩu thành công' };
  }

  // ---------------------------------------------------------------------------
  // POST /api/auth/forgot-password
  // ---------------------------------------------------------------------------

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Quên mật khẩu',
    description:
      'Gửi email chứa link đặt lại mật khẩu (hiệu lực 1 giờ) đến địa chỉ đã đăng ký. ' +
      'Luôn trả về 200 dù email có tồn tại hay không để tránh user enumeration.',
  })
  @ApiBody({ type: ForgotPasswordDto })
  @ApiResponse({
    status: HttpStatus.OK,
    description:
      'Yêu cầu đã được xử lý. Email sẽ được gửi nếu tài khoản tồn tại và đã xác thực.',
    schema: {
      example: {
        statusCode: 200,
        message:
          'Nếu email tồn tại trong hệ thống, chúng tôi đã gửi hướng dẫn đặt lại mật khẩu',
      },
    },
  })
  async forgotPassword(
    @Body() dto: ForgotPasswordDto,
  ): Promise<{ statusCode: number; message: string }> {
    await this.authService.forgotPassword(dto);
    return {
      statusCode: HttpStatus.OK,
      message:
        'Nếu email tồn tại trong hệ thống, chúng tôi đã gửi hướng dẫn đặt lại mật khẩu',
    };
  }

  // ---------------------------------------------------------------------------
  // POST /api/auth/reset-password
  // ---------------------------------------------------------------------------

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Đặt lại mật khẩu',
    description:
      'Xác thực token từ email và đặt mật khẩu mới. Token chỉ dùng được một lần và hết hạn sau 1 giờ.',
  })
  @ApiBody({ type: ResetPasswordDto })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Đặt lại mật khẩu thành công.',
    schema: {
      example: {
        statusCode: 200,
        message: 'Đặt lại mật khẩu thành công, vui lòng đăng nhập lại',
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Token không hợp lệ, đã sử dụng, hoặc đã hết hạn.',
    schema: {
      example: {
        statusCode: 400,
        message: 'Token đã hết hạn, vui lòng yêu cầu lại',
        error: 'Bad Request',
      },
    },
  })
  async resetPassword(
    @Body() dto: ResetPasswordDto,
  ): Promise<{ statusCode: number; message: string }> {
    await this.authService.resetPassword(dto);
    return {
      statusCode: HttpStatus.OK,
      message: 'Đặt lại mật khẩu thành công, vui lòng đăng nhập lại',
    };
  }
}
