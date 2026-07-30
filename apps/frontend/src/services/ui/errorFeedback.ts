import type { NormalizedApiError } from '@/services/http/httpTypes';
import { toastService } from './toastService';
import { notificationService } from './notificationService';

/* ─────────────────────────────────────────────────────────────────
 * Error Feedback Helper — hiển thị lỗi API thân thiện cho user
 * ─────────────────────────────────────────────────────────────────
 * Helper trung tâm xử lý NormalizedApiError → UI feedback.
 *
 * PHÂN BIỆT MỨC ĐỘ:
 * - 400 (validation, business rule) → toast.error (ngắn gọn)
 * - 401 (unauthorized)             → đã xử lý ở HTTP interceptor, skip
 * - 403 (forbidden)                → notification.error (cần đọc kỹ)
 * - 404 (not found)                → toast.error
 * - Network error                  → notification.error (quan trọng)
 * - 500+ (server error)            → notification.error
 *
 * BUSINESS ERROR MESSAGES TỪ BACKEND:
 * Backend trả message tiếng Việt sẵn (xem api-specification.md §8).
 * Helper này tin tưởng message từ backend và hiển thị trực tiếp,
 * chỉ thêm context khi cần thiết.
 * ───────────────────────────────────────────────────────────────── */

/**
 * Hiển thị lỗi API cho user — chọn toast hoặc notification tùy mức độ.
 * Gọi trong onError callback của useMutation hoặc catch block.
 *
 * @example
 * ```ts
 * useMutation({
 *   onError: (err) => showApiError(normalizeApiError(err)),
 * })
 * ```
 */
export function showApiError(error: NormalizedApiError) {
  // 401 — đã xử lý bởi HTTP interceptor (redirect login), không cần hiển thị thêm
  if (error.isUnauthorized) return;

  // Network error — quan trọng, dùng notification để user chú ý
  if (error.isNetworkError) {
    notificationService.error({
      message: 'Lỗi kết nối',
      description: error.message,
    });
    return;
  }

  // 403 — không đủ quyền
  if (error.isForbidden) {
    notificationService.error({
      message: 'Không đủ quyền',
      description: error.message,
    });
    return;
  }

  // Validation errors (backend trả array messages)
  if (error.validationErrors && error.validationErrors.length > 1) {
    notificationService.error({
      message: 'Dữ liệu không hợp lệ',
      description: error.validationErrors.join('\n'),
    });
    return;
  }

  // Server error (500+)
  if (error.statusCode >= 500) {
    notificationService.error({
      message: 'Lỗi hệ thống',
      description: error.message,
    });
    return;
  }

  // 400, 404, và các lỗi khác — toast ngắn gọn
  toastService.error(error.message);
}

/* ─────────────────────────────────────────────────────────────────
 * CRUD Success Feedback — messages chuẩn cho các thao tác CRUD
 * ─────────────────────────────────────────────────────────────────
 * Dùng sau khi mutation thành công. Truyền tên entity để có
 * message tự nhiên: "Tạo task thành công", "Xoá label thành công"...
 * ───────────────────────────────────────────────────────────────── */

export function showCreateSuccess(entityName: string) {
  toastService.success(`Tạo ${entityName} thành công`);
}

export function showUpdateSuccess(entityName: string) {
  toastService.success(`Cập nhật ${entityName} thành công`);
}

export function showDeleteSuccess(entityName: string) {
  toastService.success(`Xoá ${entityName} thành công`);
}

/* ─────────────────────────────────────────────────────────────────
 * Business-specific Error Feedback
 * ─────────────────────────────────────────────────────────────────
 * Các helper cho lỗi nghiệp vụ cụ thể mà backend không trả
 * message đủ rõ, hoặc frontend cần thêm context cho user.
 *
 * Phần lớn backend đã trả message tiếng Việt sẵn, nên chỉ cần
 * gọi showApiError(). Các hàm dưới đây dành cho trường hợp
 * frontend cần override hoặc bổ sung context.
 * ───────────────────────────────────────────────────────────────── */

/**
 * Lỗi liên quan đến lời mời nhóm.
 *
 * Các trường hợp thường gặp:
 * - Token không hợp lệ: user mở link invite bị sai/cắt ngắn
 * - Lời mời hết hạn: invite quá 48h chưa accept
 * - Đã là thành viên: user accept invite nhưng đã join trước đó
 */
export function showInviteError(error: NormalizedApiError) {
  // Token sai hoặc hết hạn — cần đọc kỹ, dùng notification
  if (error.statusCode === 400) {
    notificationService.error({
      message: 'Lời mời không hợp lệ',
      description: error.message,
    });
    return;
  }
  showApiError(error);
}

/**
 * Lỗi xác nhận email — token verify không hợp lệ hoặc hết hạn.
 *
 * Trường hợp:
 * - Token không tồn tại: link verify bị sai
 * - Token hết hạn (>24h): cần đăng ký lại
 */
export function showVerifyEmailError(error: NormalizedApiError) {
  notificationService.error({
    message: 'Xác nhận email thất bại',
    description: error.message,
  });
}

/**
 * Lỗi auth — email chưa verified, sai password, v.v.
 *
 * Trường hợp:
 * - 403 "Vui lòng xác nhận email trước khi đăng nhập"
 *   → User đã đăng ký nhưng chưa click link verify email
 * - 401 "Email và password sai, vui lòng thử lại"
 *   → Sai thông tin đăng nhập
 */
export function showAuthError(error: NormalizedApiError) {
  // Email chưa verified — cần giải thích rõ cho user
  if (error.isForbidden) {
    notificationService.warning({
      message: 'Email chưa xác nhận',
      description: error.message,
    });
    return;
  }
  toastService.error(error.message);
}

/**
 * Lỗi khi xoá task — chỉ owner hoặc creator mới có quyền xoá.
 *
 * Backend trả 403 "Bạn không có quyền xóa task này"
 * khi user không phải owner group cũng không phải người tạo task.
 */
export function showTaskDeleteError(error: NormalizedApiError) {
  if (error.isForbidden) {
    notificationService.error({
      message: 'Không thể xoá task',
      description: error.message,
    });
    return;
  }
  showApiError(error);
}

/**
 * Lỗi khi thao tác status không hợp lệ cho group.
 *
 * Các trường hợp:
 * - "Không thể xóa status mặc định" — status có isDefault=true
 * - "Không thể xóa, còn {n} tasks đang sử dụng status này"
 * - "Status không hợp lệ cho nhóm này" — statusId không thuộc group
 */
export function showStatusError(error: NormalizedApiError) {
  if (error.statusCode === 400) {
    notificationService.warning({
      message: 'Thao tác status không hợp lệ',
      description: error.message,
    });
    return;
  }
  showApiError(error);
}
