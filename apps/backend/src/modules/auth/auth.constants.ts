/**
 * Quy tắc mật khẩu dùng cho tất cả DTO tạo/đặt lại mật khẩu trong Auth module.
 *
 * Áp dụng cho: RegisterDto, ChangePasswordDto, ResetPasswordDto (khi có).
 * KHÔNG áp dụng cho LoginDto — đăng nhập chỉ kiểm tra hash đã lưu, không đặt mật khẩu mới.
 *
 * Quy tắc:
 * - Tối thiểu 1 chữ hoa (A-Z)
 * - Tối thiểu 1 chữ thường (a-z)
 * - Tối thiểu 1 chữ số (0-9)
 * - Tối thiểu 1 ký tự đặc biệt (không phải chữ-số)
 * - Không chứa khoảng trắng (\S)
 * - Độ dài từ 6 đến 12 ký tự
 */
export const PASSWORD_RULE =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9])\S{6,12}$/;

/**
 * Thông báo lỗi validation hiển thị khi mật khẩu không đúng quy tắc.
 * Dùng chung cho tất cả DTO áp dụng PASSWORD_RULE.
 */
export const PASSWORD_RULE_MESSAGE =
  'Mật khẩu phải có 6-12 ký tự, gồm chữ hoa, chữ thường, chữ số và ký tự đặc biệt, không chứa khoảng trắng';

/**
 * Mô tả hiển thị trên Swagger UI cho trường password.
 * Cập nhật nơi này khi quy tắc thay đổi để Swagger luôn đồng bộ.
 */
export const PASSWORD_SWAGGER_DESCRIPTION =
  'Mật khẩu: 6-12 ký tự, bắt buộc có chữ hoa, chữ thường, chữ số và ký tự đặc biệt (ví dụ: !@#$%), không chứa khoảng trắng';
