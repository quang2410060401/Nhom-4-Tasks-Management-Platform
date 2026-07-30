/* ─────────────────────────────────────────────────────────────────
 * Guard Helpers — type-safe null/empty checks
 * ─────────────────────────────────────────────────────────────────
 * Dùng cho filter, conditional rendering, và type narrowing.
 * Giữ nhẹ — chỉ những guards thực sự dùng đi dùng lại.
 * ───────────────────────────────────────────────────────────────── */

/**
 * Type guard — loại bỏ null & undefined.
 * Dùng trong .filter() để TypeScript hiểu type sau filter.
 *
 * @example
 * ```ts
 * const ids: (string | null)[] = ['a', null, 'b'];
 * const valid: string[] = ids.filter(isDefined);
 * ```
 */
export function isDefined<T>(value: T | null | undefined): value is T {
  return value != null;
}

/**
 * Kiểm tra string có giá trị (không null, undefined, empty).
 * Dùng cho form validation và conditional display.
 */
export function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Kiểm tra array có phần tử (không null, undefined, empty).
 */
export function isNonEmptyArray<T>(
  value: T[] | null | undefined,
): value is T[] & { length: number } {
  return Array.isArray(value) && value.length > 0;
}

/**
 * Kiểm tra object có key hay không (không null, undefined, empty object).
 */
export function isNonEmptyObject(value: unknown): value is Record<string, unknown> {
  return (
    value != null &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.keys(value).length > 0
  );
}
