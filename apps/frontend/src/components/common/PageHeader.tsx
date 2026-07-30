import type { ReactNode } from 'react';

/* ─────────────────────────────────────────────────────────────────
 * PageHeader — header chuẩn cho các trang chính
 * ─────────────────────────────────────────────────────────────────
 * Hiển thị tiêu đề trang, mô tả phụ, và action buttons.
 * Dùng Tailwind thay vì Ant Design PageHeader (đã deprecated).
 *
 * @example
 * ```tsx
 * <PageHeader title="Kanban Board" subtitle="Nhóm ABC" extra={<Button>Mời thành viên</Button>} />
 * ```
 * ───────────────────────────────────────────────────────────────── */

interface PageHeaderProps {
  /** Tiêu đề chính */
  title: string;
  /** Mô tả phụ — hiển thị bên dưới hoặc bên phải title */
  subtitle?: string;
  /** Actions bên phải — buttons, filters, v.v. */
  extra?: ReactNode;
}

export function PageHeader({ title, subtitle, extra }: PageHeaderProps) {
  return (
    <div className="mb-6 flex items-center justify-between">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-gray-500">{subtitle}</p>}
      </div>
      {extra && <div className="flex items-center gap-2">{extra}</div>}
    </div>
  );
}
