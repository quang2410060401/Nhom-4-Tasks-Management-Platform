/* ─────────────────────────────────────────────────────────────────
 * Common Utility Types — dùng chung trong toàn bộ app
 * ───────────────────────────────────────────────────────────────── */

/** Generic ID type — MongoDB ObjectId dưới dạng string */
export type ObjectId = string;

/**
 * Utility type — tạo partial nhưng giữ required cho một số keys.
 *
 * @example
 * type UpdateTask = RequireAtLeastOne<TaskFormValues, 'title' | 'statusId'>;
 */
export type RequireAtLeastOne<T, Keys extends keyof T = keyof T> = Pick<T, Exclude<keyof T, Keys>> &
  {
    [K in Keys]-?: Required<Pick<T, K>> & Partial<Pick<T, Exclude<Keys, K>>>;
  }[Keys];

/**
 * Utility type — biến tất cả values thành optional (deep).
 */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

/**
 * Utility type — extract non-nullable từ type.
 *
 * @example
 * type Name = NonNullableField<{ name: string | null }, 'name'>; // string
 */
export type NonNullableField<T, K extends keyof T> = T & {
  [P in K]: NonNullable<T[P]>;
};

/**
 * Select option dùng cho Ant Design Select, Radio, Checkbox, v.v.
 */
export interface SelectOption<V = string> {
  label: string;
  value: V;
  disabled?: boolean;
}

/**
 * Sort direction.
 */
export type SortDirection = 'asc' | 'desc';
