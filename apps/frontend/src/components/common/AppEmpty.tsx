import { Empty } from 'antd';
import type { ReactNode } from 'react';

/* ─────────────────────────────────────────────────────────────────
 * AppEmpty — empty state component chuẩn hoá cho toàn bộ app
 * ─────────────────────────────────────────────────────────────────
 * Wrapper cho Ant Design Empty với styling nhất quán.
 * Hỗ trợ thêm action button (ví dụ: "Tạo nhóm mới").
 * ───────────────────────────────────────────────────────────────── */

interface AppEmptyProps {
  /** Mô tả trạng thái trống */
  description?: string;
  /** Hình ảnh thay thế — mặc định dùng Empty.PRESENTED_IMAGE_SIMPLE */
  image?: ReactNode;
  /** Action button hiển thị bên dưới — ví dụ "Tạo mới" */
  children?: ReactNode;
}

export function AppEmpty({
  description = 'Không có dữ liệu',
  image = Empty.PRESENTED_IMAGE_SIMPLE,
  children,
}: AppEmptyProps) {
  return (
    <div className="flex min-h-[200px] items-center justify-center">
      <Empty image={image} description={description}>
        {children}
      </Empty>
    </div>
  );
}
