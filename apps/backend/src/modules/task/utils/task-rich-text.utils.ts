import {
  TASK_COMMENT_MAX_LENGTH,
  TASK_DESCRIPTION_MAX_TEXT_LENGTH,
  TASK_ERRORS,
} from '../task.constants';

const ALLOWED_TAGS = new Set([
  'p',
  'br',
  'strong',
  'em',
  'ul',
  'ol',
  'li',
  'a',
  'blockquote',
  'code',
]);

const SAFE_HREF_REGEX = /^(https?:\/\/|mailto:|\/)/i;

function stripDangerousBlocks(input: string): string {
  return input
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, '');
}

function sanitizeTag(
  tagName: string,
  attributes: string,
  closing: boolean,
): string {
  const normalizedTag = tagName.toLowerCase();
  if (!ALLOWED_TAGS.has(normalizedTag)) {
    return '';
  }

  if (closing) {
    return `</${normalizedTag}>`;
  }

  if (normalizedTag === 'br') {
    return '<br>';
  }

  if (normalizedTag === 'a') {
    const hrefMatch = attributes.match(/\shref=(["'])(.*?)\1/i);
    const href = hrefMatch?.[2]?.trim();
    if (href && SAFE_HREF_REGEX.test(href)) {
      const safeHref = href.replace(/"/g, '&quot;');
      return `<a href="${safeHref}" target="_blank" rel="noopener noreferrer">`;
    }

    return '<a>';
  }

  return `<${normalizedTag}>`;
}

export function sanitizeTaskDescriptionHtml(
  input: string | null | undefined,
): string | null {
  if (input == null) {
    return null;
  }

  const raw = input.trim();
  if (!raw) {
    return null;
  }

  const stripped = stripDangerousBlocks(raw);

  const sanitized = stripped.replace(
    /<\/?([a-z0-9-]+)([^>]*)>/gi,
    (fullMatch: string, tagName: string, attributes: string) => {
      const closing = fullMatch.startsWith('</');
      return sanitizeTag(tagName, attributes, closing);
    },
  );

  const textContent = extractPlainTextFromHtml(sanitized);
  if (!textContent.trim()) {
    return null;
  }

  if (textContent.length > TASK_DESCRIPTION_MAX_TEXT_LENGTH) {
    throw new Error(TASK_ERRORS.DESCRIPTION_TOO_LONG);
  }

  return sanitized;
}

export function extractPlainTextFromHtml(
  input: string | null | undefined,
): string {
  if (!input) {
    return '';
  }

  return input
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|li|blockquote|ul|ol)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#39;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\r/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function normalizeTaskCommentContent(
  input: string | null | undefined,
): string {
  const normalized = typeof input === 'string' ? input.trim() : '';
  if (!normalized) {
    throw new Error(TASK_ERRORS.COMMENT_REQUIRED);
  }
  if (normalized.length > TASK_COMMENT_MAX_LENGTH) {
    throw new Error(TASK_ERRORS.COMMENT_TOO_LONG);
  }
  return normalized;
}
