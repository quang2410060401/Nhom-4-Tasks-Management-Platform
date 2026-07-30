import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { User } from './schemas/user.schema';
import { MailService } from '../../common/mail/mail.service';

jest.mock('bcryptjs', () => ({
  hash: jest.fn().mockResolvedValue('hashed-password'),
  compare: jest.fn().mockResolvedValue(true),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const bcryptMock = require('bcryptjs') as {
  hash: jest.Mock;
  compare: jest.Mock;
};

// ---------------------------------------------------------------------------
// Mock helpers
// ---------------------------------------------------------------------------

function buildUserModel() {
  return {
    findOne: jest.fn(),
    findById: jest.fn(),
    findByIdAndUpdate: jest.fn(),
    create: jest.fn(),
  };
}

const MOCK_JWT_TOKEN = 'signed.jwt.token';

const baseUser: {
  _id: { toString: () => string };
  name: string;
  email: string;
  avatar: null;
  passwordHash: string | null;
  isEmailVerified: boolean;
  emailVerificationToken: string | null;
  emailVerificationExpiresAt: Date | null;
  lastEmailVerificationToken: string | null;
  lastEmailVerifiedAt: Date | null;
  save: jest.Mock;
} = {
  _id: { toString: () => 'user-id-123' },
  name: 'Test User',
  email: 'test@example.com',
  avatar: null,
  passwordHash: 'hashed-password',
  isEmailVerified: true,
  emailVerificationToken: null,
  emailVerificationExpiresAt: null,
  lastEmailVerificationToken: null,
  lastEmailVerifiedAt: null,
  save: jest.fn().mockResolvedValue(undefined),
};

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('AuthService', () => {
  let service: AuthService;
  let userModel: ReturnType<typeof buildUserModel>;
  let jwtService: jest.Mocked<JwtService>;
  let configService: jest.Mocked<Pick<ConfigService, 'get'>>;
  let mailService: jest.Mocked<
    Pick<MailService, 'sendVerificationEmail' | 'sendPasswordResetEmail'>
  >;

  beforeEach(async () => {
    userModel = buildUserModel();

    // Reset bcrypt mock defaults before each test
    bcryptMock.hash.mockResolvedValue('hashed-password');
    bcryptMock.compare.mockResolvedValue(true);

    const mockMailService = {
      sendVerificationEmail: jest.fn().mockResolvedValue(undefined),
      sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined),
    };

    const mockConfigService = {
      get: jest.fn().mockReturnValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: getModelToken(User.name),
          useValue: userModel,
        },
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn().mockReturnValue(MOCK_JWT_TOKEN),
          },
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: MailService,
          useValue: mockMailService,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jwtService = module.get(JwtService);
    configService = module.get(ConfigService);
    mailService = module.get(MailService);
  });

  afterEach(() => jest.resetAllMocks());

  // =========================================================================
  // register
  // =========================================================================

  describe('register', () => {
    const dto = {
      name: 'Test User',
      email: 'New@Example.com',
      password: 'secret123',
    };

    it('should register successfully and return userId', async () => {
      // No existing user
      userModel.findOne.mockReturnValue({
        lean: jest
          .fn()
          .mockReturnValue({ exec: jest.fn().mockResolvedValue(null) }),
      });

      const createdDoc = {
        _id: { toString: () => 'new-user-id' },
        name: dto.name,
        email: 'new@example.com',
      };
      userModel.create.mockResolvedValue(createdDoc);

      const result = await service.register(dto);

      expect(result).toEqual({ userId: 'new-user-id' });
      expect(userModel.findOne).toHaveBeenCalledWith({
        email: 'new@example.com',
      });
      expect(userModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'new@example.com',
          isEmailVerified: false,
        }),
      );
    });

    it('should hash the password before saving', async () => {
      userModel.findOne.mockReturnValue({
        lean: jest
          .fn()
          .mockReturnValue({ exec: jest.fn().mockResolvedValue(null) }),
      });
      userModel.create.mockResolvedValue({ _id: { toString: () => 'uid' } });

      await service.register(dto);

      expect(bcryptMock.hash).toHaveBeenCalledWith(dto.password, 12);
    });

    it('should throw BadRequestException when email already exists', async () => {
      userModel.findOne.mockReturnValue({
        lean: jest
          .fn()
          .mockReturnValue({ exec: jest.fn().mockResolvedValue(baseUser) }),
      });

      await expect(service.register(dto)).rejects.toThrow(BadRequestException);
      await expect(service.register(dto)).rejects.toThrow('Email đã tồn tại');
    });

    it('should normalise email to lowercase', async () => {
      userModel.findOne.mockReturnValue({
        lean: jest
          .fn()
          .mockReturnValue({ exec: jest.fn().mockResolvedValue(null) }),
      });
      userModel.create.mockResolvedValue({ _id: { toString: () => 'uid' } });

      await service.register({ ...dto, email: 'UPPER@EXAMPLE.COM' });

      expect(userModel.findOne).toHaveBeenCalledWith({
        email: 'upper@example.com',
      });
      expect(userModel.create).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'upper@example.com' }),
      );
    });

    it('should call sendVerificationEmail with correct url after creating user', async () => {
      configService.get.mockImplementation((key: string) =>
        key === 'FRONTEND_URL' ? 'http://localhost:5173' : undefined,
      );
      userModel.findOne.mockReturnValue({
        lean: jest
          .fn()
          .mockReturnValue({ exec: jest.fn().mockResolvedValue(null) }),
      });
      userModel.create.mockResolvedValue({
        _id: { toString: () => 'new-id' },
        name: dto.name,
        email: 'new@example.com',
      });

      await service.register(dto);

      expect(mailService.sendVerificationEmail).toHaveBeenCalledTimes(1);
      expect(mailService.sendVerificationEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          toEmail: 'new@example.com',
          toName: dto.name,
          verifyUrl: expect.stringContaining(
            'http://localhost:5173/verify-email?token=',
          ) as unknown,
        }),
      );
    });

    it('should propagate error when sendVerificationEmail fails', async () => {
      userModel.findOne.mockReturnValue({
        lean: jest
          .fn()
          .mockReturnValue({ exec: jest.fn().mockResolvedValue(null) }),
      });
      userModel.create.mockResolvedValue({
        _id: { toString: () => 'new-id' },
        name: dto.name,
        email: 'new@example.com',
      });
      (mailService.sendVerificationEmail as jest.Mock).mockRejectedValue(
        new Error('SMTP connection refused'),
      );

      await expect(service.register(dto)).rejects.toThrow(
        'SMTP connection refused',
      );
    });

    it('should translate duplicate email errors from MongoDB into BadRequestException', async () => {
      userModel.findOne.mockReturnValue({
        lean: jest
          .fn()
          .mockReturnValue({ exec: jest.fn().mockResolvedValue(null) }),
      });
      userModel.create.mockRejectedValue({
        code: 11000,
        keyPattern: { email: 1 },
      });

      await expect(service.register(dto)).rejects.toThrow(BadRequestException);
      await expect(service.register(dto)).rejects.toThrow('Email đã tồn tại');
    });
  });

  // =========================================================================
  // verifyEmail
  // =========================================================================

  describe('verifyEmail', () => {
    it('should mark email as verified and clear token fields', async () => {
      const mockUser = {
        ...baseUser,
        isEmailVerified: false,
        emailVerificationToken: 'valid-token',
        emailVerificationExpiresAt: new Date(Date.now() + 60_000),
        lastEmailVerificationToken: null,
        lastEmailVerifiedAt: null,
        save: jest.fn().mockResolvedValue(undefined),
      };

      userModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockUser),
      });

      await service.verifyEmail('valid-token');

      expect(mockUser.isEmailVerified).toBe(true);
      expect(mockUser.lastEmailVerificationToken).toBe('valid-token');
      expect(mockUser.lastEmailVerifiedAt).toBeInstanceOf(Date);
      expect(mockUser.emailVerificationToken).toBeNull();
      expect(mockUser.emailVerificationExpiresAt).toBeNull();
      expect(mockUser.save).toHaveBeenCalled();
    });

    it('should ignore a duplicate verify request shortly after success', async () => {
      const mockUser = {
        ...baseUser,
        isEmailVerified: true,
        emailVerificationToken: null,
        emailVerificationExpiresAt: null,
        lastEmailVerificationToken: 'used-token',
        lastEmailVerifiedAt: new Date(Date.now() - 30_000),
        save: jest.fn(),
      };

      userModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockUser),
      });

      await expect(service.verifyEmail('used-token')).resolves.toBeUndefined();
      expect(mockUser.save).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException for an unknown token', async () => {
      userModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(service.verifyEmail('unknown-token')).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.verifyEmail('unknown-token')).rejects.toThrow(
        'Token không hợp lệ',
      );
    });

    it('should throw BadRequestException when token is expired', async () => {
      const mockUser = {
        ...baseUser,
        isEmailVerified: false,
        emailVerificationToken: 'expired-token',
        emailVerificationExpiresAt: new Date(Date.now() - 1000), // in the past
        lastEmailVerificationToken: null,
        lastEmailVerifiedAt: null,
        save: jest.fn(),
      };

      userModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockUser),
      });

      await expect(service.verifyEmail('expired-token')).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.verifyEmail('expired-token')).rejects.toThrow(
        'Token đã hết hạn',
      );
    });

    it('should throw BadRequestException when emailVerificationExpiresAt is null', async () => {
      const mockUser = {
        ...baseUser,
        isEmailVerified: false,
        emailVerificationToken: 'any-token',
        emailVerificationExpiresAt: null,
        lastEmailVerificationToken: null,
        lastEmailVerifiedAt: null,
        save: jest.fn(),
      };

      userModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockUser),
      });

      await expect(service.verifyEmail('any-token')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should reject a reused token outside the idempotency window', async () => {
      const mockUser = {
        ...baseUser,
        isEmailVerified: true,
        emailVerificationToken: null,
        emailVerificationExpiresAt: null,
        lastEmailVerificationToken: 'old-used-token',
        lastEmailVerifiedAt: new Date(Date.now() - 11 * 60 * 1000),
        save: jest.fn(),
      };

      userModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockUser),
      });

      await expect(service.verifyEmail('old-used-token')).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.verifyEmail('old-used-token')).rejects.toThrow(
        'Token không hợp lệ',
      );
    });
  });

  // =========================================================================
  // login
  // =========================================================================

  describe('login', () => {
    const dto = { email: 'test@example.com', password: 'correct-password' };

    function mockLoginUser(overrides: Partial<typeof baseUser> = {}) {
      const user = { ...baseUser, ...overrides };
      userModel.findOne.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue(user),
          }),
        }),
      });
      return user;
    }

    it('should return accessToken and user data on success', async () => {
      mockLoginUser();
      bcryptMock.compare.mockResolvedValue(true);

      const result = await service.login(dto);

      expect(result.accessToken).toBe(MOCK_JWT_TOKEN);
      expect(result.user).toEqual({
        _id: 'user-id-123',
        name: baseUser.name,
        email: baseUser.email,
        avatar: null,
      });
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(jwtService.sign as jest.Mock).toHaveBeenCalledWith({
        sub: 'user-id-123',
        email: baseUser.email,
      });
    });

    it('should throw UnauthorizedException when user is not found', async () => {
      userModel.findOne.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest
            .fn()
            .mockReturnValue({ exec: jest.fn().mockResolvedValue(null) }),
        }),
      });

      await expect(service.login(dto)).rejects.toThrow(UnauthorizedException);
      await expect(service.login(dto)).rejects.toThrow(
        'Email và password sai, vui lòng thử lại',
      );
    });

    it('should throw ForbiddenException when email is not verified', async () => {
      mockLoginUser({ isEmailVerified: false });
      bcryptMock.compare.mockResolvedValue(true);

      await expect(service.login(dto)).rejects.toThrow(ForbiddenException);
      await expect(service.login(dto)).rejects.toThrow(
        'Vui lòng xác nhận email trước khi đăng nhập',
      );
    });

    it('should throw UnauthorizedException when password is invalid', async () => {
      mockLoginUser();
      bcryptMock.compare.mockResolvedValue(false);

      await expect(service.login(dto)).rejects.toThrow(UnauthorizedException);
      await expect(service.login(dto)).rejects.toThrow(
        'Email và password sai, vui lòng thử lại',
      );
    });

    it('should throw UnauthorizedException for Google-only account (no passwordHash)', async () => {
      mockLoginUser({ passwordHash: null });

      await expect(service.login(dto)).rejects.toThrow(UnauthorizedException);
    });

    it('should normalise email to lowercase before lookup', async () => {
      mockLoginUser();
      bcryptMock.compare.mockResolvedValue(true);

      await service.login({
        email: 'TEST@EXAMPLE.COM',
        password: dto.password,
      });

      expect(userModel.findOne).toHaveBeenCalledWith({
        email: 'test@example.com',
      });
    });
  });

  // =========================================================================
  // getProfile
  // =========================================================================

  describe('getProfile', () => {
    function mockFindById(user: unknown) {
      userModel.findById.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue(user),
          }),
        }),
      });
    }

    it('should return user profile for a valid userId', async () => {
      mockFindById(baseUser);

      const result = await service.getProfile('user-id-123');

      expect(result).toEqual({
        _id: 'user-id-123',
        name: baseUser.name,
        email: baseUser.email,
        avatar: null,
        emailVerified: true,
      });
    });

    it('should throw NotFoundException when user does not exist', async () => {
      mockFindById(null);

      await expect(service.getProfile('nonexistent-id')).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.getProfile('nonexistent-id')).rejects.toThrow(
        'Người dùng không tồn tại',
      );
    });
  });

  // =========================================================================
  // updateProfile
  // =========================================================================

  describe('updateProfile', () => {
    function mockFindByIdAndUpdate(updated: unknown) {
      userModel.findByIdAndUpdate.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue(updated),
          }),
        }),
      });
    }

    it('should update name and return new profile', async () => {
      const updated = { ...baseUser, name: 'Updated Name' };
      mockFindByIdAndUpdate(updated);

      const result = await service.updateProfile('user-id-123', {
        name: 'Updated Name',
      });

      expect(result.name).toBe('Updated Name');
      expect(userModel.findByIdAndUpdate).toHaveBeenCalledWith(
        'user-id-123',
        { $set: { name: 'Updated Name' } },
        { new: true },
      );
    });

    it('should set avatar to null when avatar is explicitly null', async () => {
      const updated = { ...baseUser, avatar: null };
      mockFindByIdAndUpdate(updated);

      const result = await service.updateProfile('user-id-123', {
        avatar: null,
      });

      expect(result.avatar).toBeNull();
    });

    it('should throw NotFoundException when user is not found during update', async () => {
      mockFindByIdAndUpdate(null);

      await expect(
        service.updateProfile('bad-id', { name: 'X' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should call getProfile when dto has no fields', async () => {
      const spy = jest.spyOn(service, 'getProfile').mockResolvedValue({
        _id: 'user-id-123',
        name: 'T',
        email: 'e@e.com',
        avatar: null,
        emailVerified: true,
      });

      await service.updateProfile('user-id-123', {});

      expect(spy).toHaveBeenCalledWith('user-id-123');
      expect(userModel.findByIdAndUpdate).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // changePassword
  // =========================================================================

  describe('changePassword', () => {
    function mockFindByIdForChange(user: unknown) {
      userModel.findById.mockReturnValue({
        select: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(user),
        }),
      });
    }

    it('should hash the new password and save', async () => {
      const mockUser = {
        ...baseUser,
        save: jest.fn().mockResolvedValue(undefined),
      };
      mockFindByIdForChange(mockUser);
      bcryptMock.compare.mockResolvedValue(true);

      await service.changePassword('user-id-123', {
        currentPassword: 'OldPass',
        newPassword: 'NewPass123',
      });

      expect(bcryptMock.hash).toHaveBeenCalledWith('NewPass123', 12);
      expect(mockUser.save).toHaveBeenCalled();
    });

    it('should throw NotFoundException when user does not exist', async () => {
      mockFindByIdForChange(null);

      await expect(
        service.changePassword('bad-id', {
          currentPassword: 'old',
          newPassword: 'newpass',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException for Google-only account', async () => {
      mockFindByIdForChange({ ...baseUser, passwordHash: null });

      await expect(
        service.changePassword('user-id-123', {
          currentPassword: 'any',
          newPassword: 'any-new',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw UnauthorizedException when currentPassword is wrong', async () => {
      mockFindByIdForChange({ ...baseUser, save: jest.fn() });
      bcryptMock.compare.mockResolvedValue(false);

      await expect(
        service.changePassword('user-id-123', {
          currentPassword: 'wrong',
          newPassword: 'NewPass123',
        }),
      ).rejects.toThrow(UnauthorizedException);
      await expect(
        service.changePassword('user-id-123', {
          currentPassword: 'wrong',
          newPassword: 'NewPass123',
        }),
      ).rejects.toThrow('Mật khẩu hiện tại không đúng');
    });

    it('should throw BadRequestException when new password equals current', async () => {
      mockFindByIdForChange({ ...baseUser, save: jest.fn() });
      bcryptMock.compare.mockResolvedValue(true);

      await expect(
        service.changePassword('user-id-123', {
          currentPassword: 'same',
          newPassword: 'same',
        }),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.changePassword('user-id-123', {
          currentPassword: 'same',
          newPassword: 'same',
        }),
      ).rejects.toThrow('Mật khẩu mới phải khác mật khẩu hiện tại');
    });
  });

  // =========================================================================
  // forgotPassword
  // =========================================================================

  describe('forgotPassword', () => {
    function mockFindOneForForgot(user: unknown) {
      userModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(user),
      });
    }

    it('should silently return when email is not found', async () => {
      mockFindOneForForgot(null);

      await expect(
        service.forgotPassword({ email: 'nobody@example.com' }),
      ).resolves.toBeUndefined();

      expect(mailService.sendPasswordResetEmail).not.toHaveBeenCalled();
    });

    it('should generate reset token and send email', async () => {
      const mockUser = {
        ...baseUser,
        passwordResetToken: null as string | null,
        passwordResetExpiresAt: null as Date | null,
        save: jest.fn().mockResolvedValue(undefined),
      };
      mockFindOneForForgot(mockUser);

      await service.forgotPassword({ email: 'test@example.com' });

      expect(mockUser.passwordResetToken).toBeTruthy();
      expect(mockUser.passwordResetExpiresAt).toBeInstanceOf(Date);
      expect(mailService.sendPasswordResetEmail).toHaveBeenCalledTimes(1);
      expect(mailService.sendPasswordResetEmail).toHaveBeenCalledWith(
        mockUser.email,
        mockUser.name,
        expect.stringContaining('/reset-password?token=') as unknown,
      );
    });

    it('should silently return for Google-only account (no passwordHash)', async () => {
      mockFindOneForForgot({ ...baseUser, passwordHash: null });

      await expect(
        service.forgotPassword({ email: 'test@example.com' }),
      ).resolves.toBeUndefined();

      expect(mailService.sendPasswordResetEmail).not.toHaveBeenCalled();
    });

    it('should clear token and throw BadRequestException when email sending fails', async () => {
      const mockUser = {
        ...baseUser,
        passwordResetToken: null as string | null,
        passwordResetExpiresAt: null as Date | null,
        save: jest.fn().mockResolvedValue(undefined),
      };
      mockFindOneForForgot(mockUser);
      (mailService.sendPasswordResetEmail as jest.Mock).mockRejectedValue(
        new Error('SMTP error'),
      );

      await expect(
        service.forgotPassword({ email: 'test@example.com' }),
      ).rejects.toThrow(BadRequestException);

      // Token must be cleared after failure
      expect(mockUser.passwordResetToken).toBeNull();
      expect(mockUser.passwordResetExpiresAt).toBeNull();
    });
  });

  // =========================================================================
  // resetPassword
  // =========================================================================

  describe('resetPassword', () => {
    function mockFindOneForReset(user: unknown) {
      userModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(user),
      });
    }

    it('should hash new password, clear token, and save', async () => {
      const mockUser = {
        ...baseUser,
        passwordResetToken: 'valid-token',
        passwordResetExpiresAt: new Date(Date.now() + 60_000),
        save: jest.fn().mockResolvedValue(undefined),
      };
      mockFindOneForReset(mockUser);

      await service.resetPassword({
        token: 'valid-token',
        newPassword: 'BrandNew123',
      });

      expect(bcryptMock.hash).toHaveBeenCalledWith('BrandNew123', 12);
      expect(mockUser.passwordResetToken).toBeNull();
      expect(mockUser.passwordResetExpiresAt).toBeNull();
      expect(mockUser.save).toHaveBeenCalled();
    });

    it('should throw BadRequestException for unknown token', async () => {
      mockFindOneForReset(null);

      await expect(
        service.resetPassword({ token: 'bad-token', newPassword: 'pass123' }),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.resetPassword({ token: 'bad-token', newPassword: 'pass123' }),
      ).rejects.toThrow('Token không hợp lệ hoặc đã được sử dụng');
    });

    it('should throw BadRequestException for expired token', async () => {
      const mockUser = {
        ...baseUser,
        passwordResetToken: 'expired-token',
        passwordResetExpiresAt: new Date(Date.now() - 5000),
        save: jest.fn().mockResolvedValue(undefined),
      };
      mockFindOneForReset(mockUser);

      await expect(
        service.resetPassword({
          token: 'expired-token',
          newPassword: 'pass123',
        }),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.resetPassword({
          token: 'expired-token',
          newPassword: 'pass123',
        }),
      ).rejects.toThrow('Token đã hết hạn, vui lòng yêu cầu lại');
    });

    it('should throw BadRequestException when passwordResetExpiresAt is null', async () => {
      const mockUser = {
        ...baseUser,
        passwordResetToken: 'any-token',
        passwordResetExpiresAt: null,
        save: jest.fn().mockResolvedValue(undefined),
      };
      mockFindOneForReset(mockUser);

      await expect(
        service.resetPassword({ token: 'any-token', newPassword: 'pass123' }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
