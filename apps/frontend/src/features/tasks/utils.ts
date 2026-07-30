import dayjs from 'dayjs';
import type { UploadFile } from 'antd';

export const TASK_TITLE_MAX_LENGTH = 200;
export const TASK_DESCRIPTION_MAX_TEXT_LENGTH = 5000;
export const TASK_COMMENT_MAX_LENGTH = 2000;
export const TASK_ATTACHMENT_MAX_FILES = 10;
export const TASK_ATTACHMENT_MAX_SIZE = Math.floor(2.5 * 1024 * 1024);

export const TASK_ALLOWED_EXTENSIONS = new Set([
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

export const TASK_ALLOWED_MIME_TYPES = new Set([
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

export function extractPlainTextFromHtml(html: string | null | undefined): string {
  if (!html) {
    return '';
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  return doc.body.textContent?.replace(/\s+/g, ' ').trim() ?? '';
}

export function normalizeRichTextHtml(html: string | null | undefined): string | null {
  const raw = html?.trim() ?? '';
  if (!raw) {
    return null;
  }

  const plainText = extractPlainTextFromHtml(raw);
  if (!plainText) {
    return null;
  }

  return raw;
}

export function validateTaskDescriptionHtml(html: string | null | undefined): string | null {
  const normalized = normalizeRichTextHtml(html);
  const plainText = extractPlainTextFromHtml(normalized);
  if (plainText.length > TASK_DESCRIPTION_MAX_TEXT_LENGTH) {
    return 'Mô tả tối đa 5000 ký tự';
  }
  return null;
}

export function validateFutureDateTime(value: dayjs.Dayjs | null | undefined): string | null {
  if (!value) {
    return null;
  }

  if (!value.isValid() || !value.isAfter(dayjs())) {
    return 'Hạn hoàn thành phải là thời điểm trong tương lai';
  }

  return null;
}

export function validateCommentContent(content: string): string | null {
  const normalized = content.trim();
  if (!normalized) {
    return 'Nội dung bình luận không được để trống';
  }
  if (normalized.length > TASK_COMMENT_MAX_LENGTH) {
    return 'Bình luận tối đa 2000 ký tự';
  }
  return null;
}

export function validateAttachmentFile(file: File): string | null {
  if (!file || file.size <= 0) {
    return 'Tệp tải lên không hợp lệ';
  }

  if (file.name.trim().length > 255) {
    return 'Tên tệp tối đa 255 ký tự';
  }

  if (file.size > TASK_ATTACHMENT_MAX_SIZE) {
    return 'Dung lượng mỗi tệp không được vượt quá 2.5MB';
  }

  const ext = file.name.includes('.')
    ? file.name.slice(file.name.lastIndexOf('.')).toLowerCase()
    : '';

  if (!TASK_ALLOWED_EXTENSIONS.has(ext) || !TASK_ALLOWED_MIME_TYPES.has(file.type)) {
    return 'Định dạng tệp không được hỗ trợ';
  }

  return null;
}

export function mapUploadFilesToFiles(fileList: UploadFile[]): File[] {
  return fileList.flatMap((item) => (item.originFileObj ? [item.originFileObj as File] : []));
}
