import type { LoginResponse, UserMe } from '@/types';

// ──── Request payloads ────

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  name: string;
  email: string;
  password: string;
}

export interface ForgotPasswordPayload {
  email: string;
}

export interface ResetPasswordPayload {
  token: string;
  newPassword: string;
}

// ──── Response types (re-export cho tiện) ────

export interface RegisterResult {
  userId: string;
}

export interface VerifyEmailResult {
  statusCode: number;
  message: string;
}

export type { LoginResponse, UserMe };
