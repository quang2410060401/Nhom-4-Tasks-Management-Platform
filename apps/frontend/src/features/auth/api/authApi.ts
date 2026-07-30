import { apiClient, unwrapResponse } from '@/services/http';
import type { ApiResponse } from '@/services/http';
import type {
  LoginPayload,
  RegisterPayload,
  RegisterResult,
  VerifyEmailResult,
  ForgotPasswordPayload,
  ResetPasswordPayload,
  LoginResponse,
  UserMe,
} from '../types';

// ──── Auth API functions ────

/** POST /auth/login */
export function loginApi(data: LoginPayload): Promise<LoginResponse> {
  return unwrapResponse(apiClient.post<ApiResponse<LoginResponse>>('/auth/login', data));
}

/** POST /auth/register */
export function registerApi(data: RegisterPayload): Promise<RegisterResult> {
  return unwrapResponse(apiClient.post<ApiResponse<RegisterResult>>('/auth/register', data));
}

/** GET /auth/verify-email?token=xxx */
export function verifyEmailApi(token: string): Promise<VerifyEmailResult> {
  return apiClient
    .get<VerifyEmailResult>('/auth/verify-email', { params: { token } })
    .then((response) => response.data);
}

/** POST /auth/forgot-password */
export function forgotPasswordApi(data: ForgotPasswordPayload): Promise<void> {
  return apiClient.post('/auth/forgot-password', data).then(() => undefined);
}

/** POST /auth/reset-password */
export function resetPasswordApi(data: ResetPasswordPayload): Promise<void> {
  return apiClient.post('/auth/reset-password', data).then(() => undefined);
}

/** GET /auth/me */
export function getMeApi(): Promise<UserMe> {
  return unwrapResponse(apiClient.get<ApiResponse<UserMe>>('/auth/me'));
}
