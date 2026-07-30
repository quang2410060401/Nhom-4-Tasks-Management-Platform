// ── Ant Design imperative API holder ──
export { setAntdInstances } from './antdHolder';

// ── UI Feedback services ──
export { toastService } from './toastService';
export { notificationService } from './notificationService';
export { modalService } from './modalService';

// ── Error presentation helpers ──
export {
  showApiError,
  showCreateSuccess,
  showUpdateSuccess,
  showDeleteSuccess,
  showInviteError,
  showVerifyEmailError,
  showAuthError,
  showTaskDeleteError,
  showStatusError,
} from './errorFeedback';
