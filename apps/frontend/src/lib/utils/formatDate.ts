import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/vi';
import { DATE_FORMAT } from '@/lib/constants/app';

/* ─────────────────────────────────────────────────────────────────
 * Date Formatting Helpers — wrapper nhẹ cho dayjs
 * ───────────────────────────────────────────────────────────────── */

// Kích hoạt plugins và locale mặc định
dayjs.extend(relativeTime);
dayjs.locale('vi');

type DateInput = string | number | Date | dayjs.Dayjs | null | undefined;

/**
 * Format ngày theo pattern — mặc định DD/MM/YYYY.
 * Trả chuỗi rỗng nếu input null/undefined/invalid.
 */
export function formatDate(date: DateInput, format: string = DATE_FORMAT.DATE): string {
  if (date == null) return '';
  const d = dayjs(date);
  return d.isValid() ? d.format(format) : '';
}

/**
 * Format ngày + giờ — mặc định DD/MM/YYYY HH:mm.
 */
export function formatDateTime(date: DateInput): string {
  return formatDate(date, DATE_FORMAT.DATETIME);
}

/**
 * Format thời gian tương đối: "2 giờ trước", "ngày mai", v.v.
 * Dùng dayjs locale "vi" để hiển thị tiếng Việt.
 */
export function formatRelative(date: DateInput): string {
  if (date == null) return '';
  const d = dayjs(date);
  return d.isValid() ? d.fromNow() : '';
}

/**
 * Kiểm tra deadline đã quá hạn chưa (so với thời điểm hiện tại).
 * Trả false nếu input null/undefined.
 */
export function isOverdue(deadline: DateInput): boolean {
  if (deadline == null) return false;
  const d = dayjs(deadline);
  return d.isValid() && d.isBefore(dayjs());
}

/**
 * Kiểm tra date có phải tương lai không — dùng cho validation deadline.
 * Backend yêu cầu deadline khi tạo task phải là future datetime.
 */
export function isFutureDate(date: DateInput): boolean {
  if (date == null) return false;
  const d = dayjs(date);
  return d.isValid() && d.isAfter(dayjs());
}
