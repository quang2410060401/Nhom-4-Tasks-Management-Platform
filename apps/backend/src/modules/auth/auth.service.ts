import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import * as bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { Model } from 'mongoose';
import { JwtPayload } from '../../common/types/jwt-payload.type';
import { MailService } from '../../common/mail/mail.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { User, UserDocument } from './schemas/user.schema';
import { LoginResult, RegisterResult, UserProfileResult } from './auth.types';

export type { LoginResult, RegisterResult, UserProfileResult };

/** Thời gian hết hạn của email verification token: 24 giờ tính bằng milliseconds. */
const VERIFICATION_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Cửa sổ idempotent cho verify email.
 * Giúp request verify lặp lại ngay sau khi thành công vẫn trả success,
 * tránh lỗi do React StrictMode, browser prefetch hoặc double-click.
 */
const VERIFICATION_IDEMPOTENCY_WINDOW_MS = 10 * 60 * 1000;

/** Thời gian hết hạn của password reset token: 1 giờ tính bằng milliseconds. */
const PASSWORD_RESET_TOKEN_TTL_MS = 60 * 60 * 1000;

/** Số vòng bcrypt — cân bằng giữa bảo mật và hiệu năng. */
const BCRYPT_SALT_ROUNDS = 12;

/** Mongo duplicate key error code. */
const MONGO_DUPLICATE_KEY_CODE = 11000;

type MongoDuplicateKeyError = {
  code?: number;
  keyPattern?: Record<string, number>;
};

function hasDuplicateKey(error: unknown, field: string): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const duplicateError = error as MongoDuplicateKeyError;
  return (
    duplicateError.code === MONGO_DUPLICATE_KEY_CODE &&
    Boolean(duplicateError.keyPattern?.[field])
  );
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly mailService: MailService,
  ) {}

  async register(dto: RegisterDto): Promise<RegisterResult> {
    const normalizedEmail = dto.email.toLowerCase().trim();

    // Kiểm tra email đã tồn tại trong hệ thống chưa
    const existing = await this.userModel
      .findOne({ email: normalizedEmail })
      .lean()
      .exec();

    if (existing) {
      throw new BadRequestException('Email đã tồn tại');
    }

    // Hash password trước khi lưu — không bao giờ lưu plain text
    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_SALT_ROUNDS);

    // Tạo token xác thực email ngẫu nhiên và thời gian hết hạn 24 giờ
    const emailVerificationToken = randomUUID();
    const emailVerificationExpiresAt = new Date(
      Date.now() + VERIFICATION_TOKEN_TTL_MS,
    );

    let user: UserDocument;

    try {
      user = await this.userModel.create({
        name: dto.name.trim(),
        email: normalizedEmail,
        passwordHash,
        isEmailVerified: false,
        emailVerificationToken,
        emailVerificationExpiresAt,
      });
    } catch (error) {
      // Bắt race condition khi 2 request đăng ký cùng email gần như đồng thời.
      if (hasDuplicateKey(error, 'email')) {
        throw new BadRequestException('Email đã tồn tại');
      }

      throw error;
    }

    this.logger.log(`User registered: ${user._id.toString()}`);

    // Gửi email xác thực tới địa chỉ vừa đăng ký
    // Nếu gửi thất bại sẽ throw lỗi — user chưa được tạo thành công theo luồng đầy đủ
    //
    const frontendUrl =
      this.configService.get<string>('FRONTEND_URL') ?? 'http://localhost:5173';
    const verifyUrl = `${frontendUrl}/verify-email?token=${emailVerificationToken}`;

    await this.mailService.sendVerificationEmail({
      toEmail: user.email,
      toName: user.name,
      verifyUrl,
    });

    return { userId: user._id.toString() };
  }

  async verifyEmail(token: string): Promise<void> {
    // Tìm user theo token xác thực email hoặc token vừa verify xong gần đây
    const user = await this.userModel
      .findOne({
        $or: [
          { emailVerificationToken: token },
          { lastEmailVerificationToken: token },
        ],
      })
      .exec();

    // Token không tồn tại trong hệ thống
    if (!user) {
      throw new BadRequestException('Token không hợp lệ');
    }

    const isRecentlyVerifiedRequest =
      user.lastEmailVerificationToken === token &&
      user.isEmailVerified &&
      Boolean(user.lastEmailVerifiedAt) &&
      Date.now() - user.lastEmailVerifiedAt!.getTime() <=
        VERIFICATION_IDEMPOTENCY_WINDOW_MS;

    if (isRecentlyVerifiedRequest) {
      this.logger.warn(
        `Duplicate verify-email request ignored for user: ${user._id.toString()}`,
      );
      return;
    }

    // Token cũ đã được dùng xong hoặc không còn nằm trong cửa sổ idempotent
    if (user.emailVerificationToken !== token) {
      throw new BadRequestException('Token không hợp lệ');
    }

    // Kiểm tra token còn hiệu lực hay đã hết hạn
    if (
      !user.emailVerificationExpiresAt ||
      user.emailVerificationExpiresAt < new Date()
    ) {
      throw new BadRequestException('Token đã hết hạn, vui lòng đăng ký lại');
    }

    // Xác nhận email thành công — cập nhật trạng thái và xóa token
    user.isEmailVerified = true;
    user.lastEmailVerificationToken = token;
    user.lastEmailVerifiedAt = new Date();
    user.emailVerificationToken = null;
    user.emailVerificationExpiresAt = null;
    await user.save();

    this.logger.log(`Email verified for user: ${user._id.toString()}`);
  }

  async login(dto: LoginDto): Promise<LoginResult> {
    const normalizedEmail = dto.email.toLowerCase().trim();

    // Tìm user theo email — dùng lean() vì chỉ đọc dữ liệu
    const user = await this.userModel
      .findOne({ email: normalizedEmail })
      .select('+passwordHash')
      .lean()
      .exec();

    // Trả về thông báo chung để tránh lộ thông tin user có tồn tại hay không
    if (!user) {
      throw new UnauthorizedException(
        'Email và password sai, vui lòng thử lại',
      );
    }

    // Từ chối đăng nhập nếu email chưa được xác thực
    if (!user.isEmailVerified) {
      throw new ForbiddenException(
        'Vui lòng xác nhận email trước khi đăng nhập',
      );
    }

    // Tài khoản tạo qua Google — chưa có mật khẩu local
    if (!user.passwordHash) {
      throw new UnauthorizedException(
        'Email và password sai, vui lòng thử lại',
      );
    }

    // So sánh password với hash đã lưu
    const isPasswordValid = await bcrypt.compare(
      dto.password,
      user.passwordHash,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException(
        'Email và password sai, vui lòng thử lại',
      );
    }

    const userId = user._id.toString();

    // Tạo JWT payload an toàn — chỉ chứa userId và email, không có dữ liệu nhạy cảm
    const payload: JwtPayload = { sub: userId, email: user.email };
    const accessToken = this.jwtService.sign(payload);

    this.logger.log(`User logged in: ${userId}`);

    // Trả về access token và thông tin cơ bản của user — không trả raw document
    return {
      accessToken,
      user: {
        _id: userId,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
      },
    };
  }

  // TODO: implement googleLogin(idToken: string): Promise<LoginResult>
  //  - Inject FirebaseAdminService (to be created in src/common/firebase/)
  //  - Call firebaseAdminService.verifyIdToken(idToken)
  //  - Extract { email, name, picture, uid } from decoded token
  //  - Find user by googleId first, then by email (for account linking)
  //  - If found by email only → set googleId = uid, isEmailVerified = true
  //  - If not found → create new user (isEmailVerified = true, no passwordHash)
  //  - Sign and return JWT the same way as login()

  // ---------------------------------------------------------------------------
  // GET /auth/me — Thông tin user hiện tại
  // ---------------------------------------------------------------------------

  async getProfile(userId: string): Promise<UserProfileResult> {
    const user = await this.userModel
      .findById(userId)
      .select('name email avatar isEmailVerified')
      .lean()
      .exec();

    if (!user) {
      throw new NotFoundException('Người dùng không tồn tại');
    }

    return {
      _id: user._id.toString(),
      name: user.name,
      email: user.email,
      avatar: user.avatar ?? null,
      emailVerified: user.isEmailVerified,
    };
  }

  // ---------------------------------------------------------------------------
  // PATCH /auth/me — Cập nhật profile
  // ---------------------------------------------------------------------------

  async updateProfile(
    userId: string,
    dto: UpdateProfileDto,
  ): Promise<UserProfileResult> {
    if (dto.name === undefined && dto.avatar === undefined) {
      // Không có gì để update — trả về profile hiện tại
      return this.getProfile(userId);
    }

    const update: Record<string, unknown> = {};
    if (dto.name !== undefined) update.name = dto.name.trim();
    // avatar có thể là null (xóa avatar) hoặc string URL (cập nhật)
    if (dto.avatar !== undefined) update.avatar = dto.avatar;

    const updated = await this.userModel
      .findByIdAndUpdate(userId, { $set: update }, { new: true })
      .select('name email avatar isEmailVerified')
      .lean()
      .exec();

    if (!updated) {
      throw new NotFoundException('Người dùng không tồn tại');
    }

    this.logger.log(`User ${userId} cập nhật profile`);

    return {
      _id: updated._id.toString(),
      name: updated.name,
      email: updated.email,
      avatar: updated.avatar ?? null,
      emailVerified: updated.isEmailVerified,
    };
  }

  // ---------------------------------------------------------------------------
  // POST /auth/change-password — Đổi mật khẩu
  // ---------------------------------------------------------------------------

  async changePassword(userId: string, dto: ChangePasswordDto): Promise<void> {
    const user = await this.userModel
      .findById(userId)
      .select('+passwordHash')
      .exec();

    if (!user) {
      throw new NotFoundException('Người dùng không tồn tại');
    }

    // Tài khoản Google (không có mật khẩu) không thể đổi mật khẩu theo luồng này
    if (!user.passwordHash) {
      throw new BadRequestException(
        'Tài khoản này không hỗ trợ đổi mật khẩu bằng email/password',
      );
    }

    const isCurrentValid = await bcrypt.compare(
      dto.currentPassword,
      user.passwordHash,
    );

    if (!isCurrentValid) {
      throw new UnauthorizedException('Mật khẩu hiện tại không đúng');
    }

    if (dto.currentPassword === dto.newPassword) {
      throw new BadRequestException('Mật khẩu mới phải khác mật khẩu hiện tại');
    }

    user.passwordHash = await bcrypt.hash(dto.newPassword, BCRYPT_SALT_ROUNDS);
    await user.save();

    this.logger.log(`User ${userId} đổi mật khẩu thành công`);
  }

  // ---------------------------------------------------------------------------
  // POST /auth/forgot-password — Quên mật khẩu
  // ---------------------------------------------------------------------------

  /**
   * Luôn trả về thành công dù email có tồn tại hay không — ngăn user enumeration.
   * Nếu user không tồn tại hoặc chưa verify email → im lặng, không gửi email.
   */
  async forgotPassword(dto: ForgotPasswordDto): Promise<void> {
    const normalizedEmail = dto.email.toLowerCase().trim();

    const user = await this.userModel
      .findOne({ email: normalizedEmail, isEmailVerified: true })
      .exec();

    // Im lặng nếu user không tồn tại hoặc chưa verify — tránh user enumeration
    if (!user) {
      this.logger.debug(
        `forgotPassword: email không tìm thấy hoặc chưa verify — ${normalizedEmail}`,
      );
      return;
    }

    // Tài khoản Google (không có mật khẩu) — im lặng, không gửi email reset
    if (!user.passwordHash) {
      this.logger.debug(
        `forgotPassword: tài khoản Google, không gửi reset email — ${normalizedEmail}`,
      );
      return;
    }

    const resetToken = randomUUID();
    const resetExpiresAt = new Date(Date.now() + PASSWORD_RESET_TOKEN_TTL_MS);

    user.passwordResetToken = resetToken;
    user.passwordResetExpiresAt = resetExpiresAt;
    await user.save();

    const frontendUrl =
      this.configService.get<string>('FRONTEND_URL') ?? 'http://localhost:5173';
    const resetUrl = `${frontendUrl}/reset-password?token=${resetToken}`;

    // Gửi email — nếu thất bại, ghi log nhưng không throw (không lộ lỗi SMTP ra ngoài)
    try {
      await this.mailService.sendPasswordResetEmail(
        user.email,
        user.name,
        resetUrl,
      );
    } catch (error) {
      // Reset lại token để tránh token bị lưu mà email không được gửi
      user.passwordResetToken = null;
      user.passwordResetExpiresAt = null;
      await user.save();
      this.logger.error(
        `Gửi email đặt lại mật khẩu thất bại cho ${normalizedEmail}`,
        error instanceof Error ? error.stack : String(error),
      );
      throw new BadRequestException(
        'Không thể gửi email đặt lại mật khẩu, vui lòng thử lại sau',
      );
    }

    this.logger.log(
      `Password reset email gửi thành công tới: ${normalizedEmail}`,
    );
  }

  // ---------------------------------------------------------------------------
  // POST /auth/reset-password — Đặt lại mật khẩu
  // ---------------------------------------------------------------------------

  async resetPassword(dto: ResetPasswordDto): Promise<void> {
    const user = await this.userModel
      .findOne({ passwordResetToken: dto.token })
      .exec();

    if (!user) {
      throw new BadRequestException('Token không hợp lệ hoặc đã được sử dụng');
    }

    if (
      !user.passwordResetExpiresAt ||
      user.passwordResetExpiresAt < new Date()
    ) {
      // Xóa token hết hạn để dọn dẹp DB
      user.passwordResetToken = null;
      user.passwordResetExpiresAt = null;
      await user.save();
      throw new BadRequestException('Token đã hết hạn, vui lòng yêu cầu lại');
    }

    user.passwordHash = await bcrypt.hash(dto.newPassword, BCRYPT_SALT_ROUNDS);
    user.passwordResetToken = null;
    user.passwordResetExpiresAt = null;
    await user.save();

    this.logger.log(`User ${user._id.toString()} đặt lại mật khẩu thành công`);
  }
}
