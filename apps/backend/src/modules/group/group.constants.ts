/**
 * Thông điệp lỗi chuẩn của Group module.
 * Tập trung tại đây để dễ nhất quán và tái sử dụng từ service.
 */
export const GROUP_ERRORS = {
  NOT_FOUND: 'Nhóm không tồn tại',
  NAME_ALREADY_EXISTS: 'Tên nhóm đã tồn tại trong hệ thống',
  FORBIDDEN: 'Bạn không có quyền truy cập nhóm này',
  /** Thông báo chung dùng trong GroupOwnerGuard — không biết context action cụ thể. */
  ONLY_OWNER: 'Bạn không có quyền thực hiện hành động này',
  /** Thông báo chung dùng trong GroupAdminGuard. */
  ONLY_MANAGER: 'Bạn không có quyền thực hiện hành động này',
  /** Dùng trong service.inviteMember — khớp API spec mục 3.4. */
  ONLY_OWNER_INVITE: 'Chỉ owner mới có thể mời thành viên',
  /** Dùng trong service.removeMember — khớp API spec mục 3.6. */
  ONLY_OWNER_REMOVE: 'Chỉ owner mới có thể xóa thành viên',
  CANNOT_REMOVE_OWNER: 'Owner không thể tự xóa khỏi nhóm',
  CANNOT_CHANGE_OWNER_ROLE: 'Không thể thay đổi vai trò của owner',
  ALREADY_MEMBER: 'Người dùng đã là thành viên của nhóm',
  NOT_MEMBER: 'Bạn không phải thành viên của nhóm này',
  /** Dùng trong service.removeMember — mô tả người dùng mục tiêu (không phải requester). */
  TARGET_NOT_MEMBER: 'Người dùng này chưa là thành viên của nhóm',
  INVITE_ALREADY_SENT: 'Lời mời đã được gửi trước đó',
  INVITE_NOT_FOUND: 'Lời mời không tồn tại',
  INVITE_EMAIL_INVALID: 'Danh sách email mời có email không hợp lệ',
  INVITE_EMAIL_MISMATCH:
    'Lời mời này thuộc về một tài khoản email khác. Vui lòng đăng nhập đúng email được mời',
  INVITE_INVALID_TOKEN: 'Token không hợp lệ',
  INVITE_EXPIRED: 'Lời mời đã hết hạn',
  STATUS_NOT_FOUND: 'Status không tồn tại',
  STATUS_DUPLICATE: 'Danh sách statuses có tên hoặc slug bị trùng',
  STATUS_REQUIRED: 'Nhóm phải có ít nhất 1 status',
  STATUS_CANNOT_DELETE_DEFAULT: 'Không thể xóa status mặc định',
  STATUS_HAS_TASKS: (count: number) =>
    `Không thể xóa, còn ${count} tasks đang sử dụng status này`,
  LABEL_NOT_FOUND: 'Nhãn không tồn tại',
  LABEL_DUPLICATE: 'Danh sách labels có tên bị trùng',
} as const;

/** Thời gian hết hạn lời mời tham gia nhóm: 48 giờ (milliseconds). */
export const INVITE_TOKEN_TTL_MS = 48 * 60 * 60 * 1000;

/**
 * 3 statuses mặc định được seed tự động khi tạo nhóm mới.
 * Thứ tự và giá trị này phản ánh đúng API spec — không sửa.
 *
 * TODO (batch Task): đảm bảo logic task luôn tham chiếu đến statusId,
 * không hardcode "todo" string để xử lý trường hợp owner tuỳ chỉnh slug.
 */
export const DEFAULT_STATUSES = [
  {
    name: 'Todo',
    slug: 'todo',
    color: '#3B82F6',
    order: 1,
    isDefault: true,
    isCompleted: false,
  },
  {
    name: 'Doing',
    slug: 'doing',
    color: '#F59E0B',
    order: 2,
    isDefault: false,
    isCompleted: false,
  },
  {
    name: 'Done',
    slug: 'done',
    color: '#10B981',
    order: 3,
    isDefault: false,
    isCompleted: true,
  },
] as const;
