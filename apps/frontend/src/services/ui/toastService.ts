import { getMessageApi } from './antdHolder';

/* ─────────────────────────────────────────────────────────────────
 * Toast Service — wrapper cho Ant Design message API
 * ─────────────────────────────────────────────────────────────────
 * Sử dụng cho feedback nhanh (2-3 giây) sau hành động của user:
 * - Tạo/cập nhật/xoá thành công
 * - Lỗi validation nhẹ
 * - Thông báo ngắn
 *
 * KHÔNG dùng cho:
 * - Lỗi quan trọng cần hành động — dùng notificationService
 * - Xác nhận trước xoá — dùng modalService.confirm
 * ───────────────────────────────────────────────────────────────── */

const DEFAULT_DURATION = 3; // giây

export const toastService = {
  success(content: string, duration = DEFAULT_DURATION) {
    getMessageApi().success(content, duration);
  },

  error(content: string, duration = DEFAULT_DURATION) {
    getMessageApi().error(content, duration);
  },

  warning(content: string, duration = DEFAULT_DURATION) {
    getMessageApi().warning(content, duration);
  },

  info(content: string, duration = DEFAULT_DURATION) {
    getMessageApi().info(content, duration);
  },

  loading(content: string, duration = DEFAULT_DURATION) {
    return getMessageApi().loading(content, duration);
  },
};
