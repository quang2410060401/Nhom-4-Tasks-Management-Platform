import type { ReactNode } from 'react';
import { modalService } from '@/services/ui';

/* ─────────────────────────────────────────────────────────────────
 * ConfirmAction — trigger component mở confirm dialog
 * ─────────────────────────────────────────────────────────────────
 * Wrap một button/icon/link — khi click, hiện confirm dialog
 * trước khi thực thi hành động destructive.
 *
 * @example
 * ```tsx
 * <ConfirmAction
 *   title="Xoá task?"
 *   content="Task sẽ bị xoá vĩnh viễn."
 *   onConfirm={() => deleteTask(taskId)}
 * >
 *   <Button danger icon={<DeleteOutlined />}>Xoá</Button>
 * </ConfirmAction>
 * ```
 * ───────────────────────────────────────────────────────────────── */

interface ConfirmActionProps {
  /** Tiêu đề dialog */
  title: string;
  /** Nội dung mô tả — giải thích hậu quả của hành động */
  content?: string;
  /** Text nút xác nhận */
  okText?: string;
  /** Text nút huỷ */
  cancelText?: string;
  /** Callback thực thi khi user xác nhận */
  onConfirm: () => void | Promise<void>;
  /** Hành động nguy hiểm — nút OK màu đỏ (mặc định true) */
  danger?: boolean;
  /** Trigger element — click vào element này mở dialog */
  children: ReactNode;
}

export function ConfirmAction({
  title,
  content,
  okText,
  cancelText,
  onConfirm,
  danger = true,
  children,
}: ConfirmActionProps) {
  const handleClick = () => {
    if (danger) {
      modalService.confirmDelete({
        title,
        content,
        okText,
        cancelText,
        onOk: onConfirm,
      });
    } else {
      modalService.confirm({
        title,
        content,
        okText,
        cancelText,
        onOk: onConfirm,
      });
    }
  };

  return (
    <span
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') handleClick();
      }}
    >
      {children}
    </span>
  );
}
