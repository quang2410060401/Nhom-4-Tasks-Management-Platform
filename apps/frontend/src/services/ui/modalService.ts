import { getModalApi } from './antdHolder';

/* ─────────────────────────────────────────────────────────────────
 * Modal Service — wrapper cho Ant Design modal confirm API
 * ─────────────────────────────────────────────────────────────────
 * Sử dụng cho các hành động phá huỷ (destructive actions):
 * - Xoá task, status, label, member
 * - Rời nhóm, huỷ lời mời
 * - Bất kỳ hành động không thể undo
 *
 * VÌ SAO DÙNG WRAPPER THAY VÌ Modal.confirm() TRỰC TIẾP:
 * - Tập trung styling cho destructive confirm (danger button, icon)
 * - Dễ đổi copy / thêm rules chung sau này
 * - Tránh import modal API khắp nơi
 * ───────────────────────────────────────────────────────────────── */

interface ConfirmOptions {
  title: string;
  content?: string;
  okText?: string;
  cancelText?: string;
  onOk: () => void | Promise<void>;
}

export const modalService = {
  /**
   * Confirm dialog cho hành động xoá / phá huỷ.
   * Mặc định nút OK đỏ (danger) và text "Xoá".
   */
  confirmDelete({ title, content, okText = 'Xoá', cancelText = 'Huỷ', onOk }: ConfirmOptions) {
    getModalApi().confirm({
      title,
      content,
      okText,
      cancelText,
      okButtonProps: { danger: true },
      onOk,
    });
  },

  /**
   * Confirm dialog chung — không mặc định danger.
   * Dùng cho các xác nhận không phải destructive.
   */
  confirm({ title, content, okText = 'Xác nhận', cancelText = 'Huỷ', onOk }: ConfirmOptions) {
    getModalApi().confirm({
      title,
      content,
      okText,
      cancelText,
      onOk,
    });
  },

  /**
   * Warning dialog — cảnh báo user trước khi tiếp tục.
   */
  warning({ title, content, okText = 'Đã hiểu', cancelText = 'Huỷ', onOk }: ConfirmOptions) {
    getModalApi().warning({
      title,
      content,
      okText,
      cancelText,
      onOk,
    });
  },
};
