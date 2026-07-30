/**
 * Feature: Statuses (Trạng thái)
 * Quản lý CRUD statuses cho mỗi group.
 *
 * Metadata quan trọng từ backend:
 * - _id, name, slug, color, order, isDefault, isCompleted
 * - Render theo thứ tự order
 * - isDefault: status mặc định khi tạo task mới
 * - isCompleted: status đánh dấu task hoàn thành
 *
 * Cấu trúc sẽ bao gồm:
 * - api/        → API calls cho status endpoints
 * - components/ → StatusList, StatusForm, StatusBadge...
 * - hooks/      → useStatuses, useCreateStatus...
 * - schemas/    → Yup validation schemas
 * - types.ts    → Status-specific types
 */
