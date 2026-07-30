import type { MessageInstance } from 'antd/es/message/interface';
import type { NotificationInstance } from 'antd/es/notification/interface';
import type { ModalStaticFunctions } from 'antd/es/modal/confirm';

/* ─────────────────────────────────────────────────────────────────
 * Ant Design Imperative API Holder
 * ─────────────────────────────────────────────────────────────────
 * VÌ SAO KHÔNG DÙNG STATIC API (message.success, Modal.confirm...):
 *
 * Ant Design v5+ khuyến khích dùng App.useApp() hooks thay vì
 * static methods. Static API không nhận được ConfigProvider context
 * (theme, locale) và khó kiểm soát lifecycle.
 *
 * Pattern ở đây:
 * 1. AntdProvider render <App>, bên trong gọi useApp()
 * 2. useApp() trả message/notification/modal instances
 * 3. Instances được lưu vào holder này qua setAntdInstances()
 * 4. Các service (toastService, modalService...) đọc từ holder
 *
 * Như vậy service functions có thể gọi từ BẤT KỲ đâu (hooks,
 * event handlers, mutation callbacks) mà vẫn nhận được theme context.
 *
 * QUAN TRỌNG: setAntdInstances() phải được gọi 1 lần duy nhất
 * từ AntdAppSetup component bên trong AntdProvider.
 * ───────────────────────────────────────────────────────────────── */

type ModalInstance = Omit<ModalStaticFunctions, 'warn'>;

let messageApi: MessageInstance | null = null;
let notificationApi: NotificationInstance | null = null;
let modalApi: ModalInstance | null = null;

/**
 * Lưu Ant Design imperative instances — gọi từ AntdAppSetup.
 * Chỉ gọi 1 lần khi app mount.
 */
export function setAntdInstances(
  message: MessageInstance,
  notification: NotificationInstance,
  modal: ModalInstance,
) {
  messageApi = message;
  notificationApi = notification;
  modalApi = modal;
}

export function getMessageApi(): MessageInstance {
  if (!messageApi) throw new Error('Ant Design message API chưa được khởi tạo');
  return messageApi;
}

export function getNotificationApi(): NotificationInstance {
  if (!notificationApi) throw new Error('Ant Design notification API chưa được khởi tạo');
  return notificationApi;
}

export function getModalApi(): ModalInstance {
  if (!modalApi) throw new Error('Ant Design modal API chưa được khởi tạo');
  return modalApi;
}
