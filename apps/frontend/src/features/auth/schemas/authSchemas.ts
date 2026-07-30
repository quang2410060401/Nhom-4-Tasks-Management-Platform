import * as yup from 'yup';

/**
 * Password rule mirrored từ backend (auth.constants.ts).
 * 6-12 ký tự, ít nhất 1 uppercase, 1 lowercase, 1 chữ số, 1 ký tự đặc biệt, không có khoảng trắng.
 */
const PASSWORD_RULE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9\s]).{6,12}$/;
const PASSWORD_RULE_MESSAGE =
  'Mật khẩu phải có 6-12 ký tự, bao gồm chữ hoa, chữ thường, số và ký tự đặc biệt';

// ──── Login ────

export const loginSchema = yup.object({
  email: yup.string().required('Vui lòng nhập email').email('Email không đúng định dạng'),
  password: yup.string().required('Vui lòng nhập mật khẩu'),
});

export type LoginFormValues = yup.InferType<typeof loginSchema>;

// ──── Register ────

export const registerSchema = yup.object({
  name: yup
    .string()
    .required('Vui lòng nhập họ tên')
    .min(1, 'Họ tên không được để trống')
    .max(100, 'Họ tên tối đa 100 ký tự'),
  email: yup.string().required('Vui lòng nhập email').email('Email không đúng định dạng'),
  password: yup
    .string()
    .required('Vui lòng nhập mật khẩu')
    .matches(PASSWORD_RULE, PASSWORD_RULE_MESSAGE),
  confirmPassword: yup
    .string()
    .required('Vui lòng xác nhận mật khẩu')
    .oneOf([yup.ref('password')], 'Mật khẩu xác nhận không khớp'),
});

export type RegisterFormValues = yup.InferType<typeof registerSchema>;

// ──── Forgot Password ────

export const forgotPasswordSchema = yup.object({
  email: yup.string().required('Vui lòng nhập email').email('Email không đúng định dạng'),
});

export type ForgotPasswordFormValues = yup.InferType<typeof forgotPasswordSchema>;

// ──── Reset Password ────

export const resetPasswordSchema = yup.object({
  newPassword: yup
    .string()
    .required('Vui lòng nhập mật khẩu mới')
    .matches(PASSWORD_RULE, PASSWORD_RULE_MESSAGE),
  confirmPassword: yup
    .string()
    .required('Vui lòng xác nhận mật khẩu')
    .oneOf([yup.ref('newPassword')], 'Mật khẩu xác nhận không khớp'),
});

export type ResetPasswordFormValues = yup.InferType<typeof resetPasswordSchema>;
