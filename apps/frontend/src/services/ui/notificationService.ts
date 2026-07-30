import type { ReactNode } from 'react';
import { getNotificationApi } from './antdHolder';

/* ─────────────────────────────────────────────────────────────────
 * Notification Service — wrapper cho Ant Design notification API
 * ─────────────────────────────────────────────────────────────────
 * Sử dụng cho thông báo quan trọng hơn toast:
 * - Lỗi nghiêm trọng cần user đọc kỹ
 * - Thông báo có tiêu đề + mô tả
 * - Phản hồi cần hiển thị lâu hơn (4.5s mặc định)
 *
 * Khác biệt so với toastService:
 * - Có title + description (2 dòng)
 * - Hiển thị ở góc thay vì top-center
 * - Có thể kèm action button
 * ───────────────────────────────────────────────────────────────── */

interface NotifyOptions {
  message: string;
  description?: ReactNode;
  duration?: number;
}

export const notificationService = {
  success({ message, description, duration }: NotifyOptions) {
    getNotificationApi().success({ message, description, duration });
  },

  error({ message, description, duration }: NotifyOptions) {
    getNotificationApi().error({ message, description, duration });
  },

  warning({ message, description, duration }: NotifyOptions) {
    getNotificationApi().warning({ message, description, duration });
  },

  info({ message, description, duration }: NotifyOptions) {
    getNotificationApi().info({ message, description, duration });
  },
};
