// HTTP client & helpers
export {
  apiClient,
  createCancelToken,
  cancellableGet,
  unwrapResponse,
  normalizeApiError,
  getErrorMessage,
  isApiError,
} from './http';
export type {
  ApiResponse,
  ApiErrorResponse,
  PaginatedData,
  PaginationMeta,
  PaginationParams,
  NormalizedApiError,
  ApiAxiosError,
  ApiAxiosResponse,
} from './http';

// Auth session & token storage
export { tokenStorage, authSession } from './auth';
export {
  TOKEN_STORAGE_KEY,
  PUBLIC_AUTH_ROUTES,
  DEFAULT_ERROR_MESSAGE,
  NETWORK_ERROR_MESSAGE,
} from './auth';

// UI feedback services
export {
  toastService,
  notificationService,
  modalService,
  showApiError,
  showCreateSuccess,
  showUpdateSuccess,
  showDeleteSuccess,
  showInviteError,
  showVerifyEmailError,
  showAuthError,
  showTaskDeleteError,
  showStatusError,
} from './ui';
