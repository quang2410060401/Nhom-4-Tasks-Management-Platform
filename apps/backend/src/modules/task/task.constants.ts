export const TASK_DESCRIPTION_MAX_TEXT_LENGTH = 5000;
export const TASK_COMMENT_MAX_LENGTH = 2000;
export const TASK_ATTACHMENT_MAX_FILES = 10;
export const TASK_ATTACHMENT_MAX_SIZE = Math.floor(2.5 * 1024 * 1024);
export const TASK_REMINDER_CRON_EXPRESSION = '*/15 * * * *';
export const TASK_OVERDUE_CRON_EXPRESSION = '*/15 * * * *';
export const TASK_REMINDER_WINDOW_MINUTES = 60;
export const TASK_REMINDER_RESEND_COOLDOWN_MINUTES = 60;

export const TASK_ATTACHMENT_ALLOWED_EXTENSIONS = new Set([
  '.pdf',
  '.doc',
  '.docx',
  '.xls',
  '.xlsx',
  '.ppt',
  '.pptx',
  '.txt',
  '.csv',
  '.png',
  '.jpg',
  '.jpeg',
  '.webp',
  '.gif',
  '.zip',
]);

export const TASK_ATTACHMENT_ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'text/csv',
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'application/zip',
  'application/x-zip-compressed',
]);

export const TASK_ERRORS = {
  NOT_FOUND: 'Task không tồn tại',
  STATUS_NOT_IN_GROUP: 'Status không hợp lệ cho nhóm này',
  DEFAULT_STATUS_NOT_FOUND:
    'Nhóm chưa có status mặc định, vui lòng liên hệ owner',
  ASSIGNEE_NOT_MEMBER: 'Người được giao phải là thành viên của nhóm',
  LABEL_NOT_IN_GROUP: 'Một hoặc nhiều label không thuộc nhóm này',
  DEADLINE_IN_PAST: 'Hạn hoàn thành phải là thời điểm trong tương lai',
  FORBIDDEN_DELETE: 'Bạn không có quyền xóa task này',
  TITLE_REQUIRED: 'Tiêu đề không được để trống',
  TITLE_TOO_LONG: 'Tiêu đề tối đa 200 ký tự',
  DESCRIPTION_TOO_LONG: 'Mô tả tối đa 5000 ký tự',
  COMMENT_REQUIRED: 'Nội dung bình luận không được để trống',
  COMMENT_TOO_LONG: 'Bình luận tối đa 2000 ký tự',
  COMMENT_NOT_FOUND: 'Bình luận không tồn tại',
  COMMENT_FORBIDDEN: 'Bạn không có quyền chỉnh sửa bình luận này',
  COMMENT_DELETE_FORBIDDEN: 'Bạn không có quyền xóa bình luận này',
  ATTACHMENT_NOT_FOUND: 'Tệp đính kèm không tồn tại',
  ATTACHMENT_FORBIDDEN: 'Bạn không có quyền xóa tệp đính kèm này',
  ATTACHMENT_LIMIT: 'Tối đa 10 tệp cho mỗi công việc',
  ATTACHMENT_TOO_LARGE: 'Dung lượng mỗi tệp không được vượt quá 2.5MB',
  ATTACHMENT_EMPTY: 'Tệp tải lên không hợp lệ',
  ATTACHMENT_UNSUPPORTED: 'Định dạng tệp không được hỗ trợ',
  ATTACHMENT_NAME_TOO_LONG: 'Tên tệp tối đa 255 ký tự',
} as const;
