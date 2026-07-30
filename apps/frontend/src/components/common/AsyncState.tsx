import type { ReactNode } from 'react';
import { Spin, Alert, Empty } from 'antd';

/* ─────────────────────────────────────────────────────────────────
 * AsyncState — component hiển thị loading / error / empty / data
 * ─────────────────────────────────────────────────────────────────
 * Dùng để wrap kết quả từ useQuery. Thay vì viết if/else loading/
 * error/empty trong mỗi page, dùng component này.
 *
 * @example
 * ```tsx
 * <AsyncState loading={isLoading} error={error} data={groups} emptyText="Chưa có nhóm nào">
 *   {(data) => <GroupList groups={data} />}
 * </AsyncState>
 * ```
 * ───────────────────────────────────────────────────────────────── */

interface AsyncStateProps<T> {
  /** Đang tải dữ liệu */
  loading: boolean;
  /** Error object — hiển thị Alert nếu có */
  error?: { message: string } | null;
  /** Dữ liệu đã fetch — null/undefined/empty array = empty state */
  data: T | null | undefined;
  /** Text hiển thị khi data rỗng */
  emptyText?: string;
  /** Render function nhận data đã có (non-null) */
  children: (data: T) => ReactNode;
}

/** Kiểm tra data có "rỗng" không — null, undefined, hoặc array rỗng */
function isEmpty(data: unknown): boolean {
  if (data == null) return true;
  if (Array.isArray(data)) return data.length === 0;
  return false;
}

export function AsyncState<T>({
  loading,
  error,
  data,
  emptyText = 'Không có dữ liệu',
  children,
}: AsyncStateProps<T>) {
  if (loading) {
    return (
      <div className="flex min-h-[200px] items-center justify-center">
        <Spin size="large" />
      </div>
    );
  }

  if (error) {
    return <Alert type="error" message="Đã xảy ra lỗi" description={error.message} showIcon />;
  }

  if (isEmpty(data)) {
    return (
      <div className="flex min-h-[200px] items-center justify-center">
        <Empty description={emptyText} />
      </div>
    );
  }

  return <>{children(data as T)}</>;
}
