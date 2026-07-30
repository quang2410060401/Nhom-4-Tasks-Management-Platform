/* ─────────────────────────────────────────────────────────────────
 * Query String Helpers — parse & build URL query params
 * ───────────────────────────────────────────────────────────────── */

/**
 * Parse query string thành object — wrapper nhẹ cho URLSearchParams.
 *
 * @example
 * ```ts
 * parseQueryString('?token=abc&redirect=/groups')
 * // → { token: 'abc', redirect: '/groups' }
 * ```
 */
export function parseQueryString(search: string): Record<string, string> {
  const params = new URLSearchParams(search);
  const result: Record<string, string> = {};
  params.forEach((value, key) => {
    result[key] = value;
  });
  return result;
}

/**
 * Lấy 1 param từ query string — trả null nếu không có.
 *
 * @example
 * ```ts
 * getQueryParam('?token=abc', 'token') // → 'abc'
 * getQueryParam('?page=1', 'token')    // → null
 * ```
 */
export function getQueryParam(search: string, key: string): string | null {
  return new URLSearchParams(search).get(key);
}

/**
 * Build query string từ object — bỏ qua null/undefined/empty values.
 *
 * @example
 * ```ts
 * buildQueryString({ search: 'hello', assigneeId: null, page: 1 })
 * // → '?search=hello&page=1'
 * ```
 */
export function buildQueryString(
  params: Record<string, string | number | boolean | null | undefined>,
): string {
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value != null && value !== '') {
      searchParams.set(key, String(value));
    }
  }
  const str = searchParams.toString();
  return str ? `?${str}` : '';
}
