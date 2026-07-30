/**
 * Kết quả trả về sau khi đăng ký tài khoản thành công.
 */
export interface RegisterResult {
  /** ObjectId của user vừa được tạo. */
  userId: string;
}

/**
 * Kết quả trả về sau khi đăng nhập thành công.
 */
export interface LoginResult {
  /** JWT access token để dùng cho các request cần xác thực. */
  accessToken: string;
  /** Thông tin cơ bản của user — không trả về dữ liệu nhạy cảm. */
  user: {
    _id: string;
    name: string;
    email: string;
    avatar: string | null;
  };
}

/**
 * Thông tin profile của user hiện tại.
 */
export interface UserProfileResult {
  _id: string;
  name: string;
  email: string;
  avatar: string | null;
  emailVerified: boolean;
}
