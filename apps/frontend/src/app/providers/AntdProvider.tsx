import type { ReactNode } from 'react';
import { ConfigProvider, App } from 'antd';
import { setAntdInstances } from '@/services/ui/antdHolder';

/**
 * Bên trong <App>, dùng useApp() để lấy message/notification/modal
 * instances có context từ ConfigProvider, rồi lưu vào holder.
 *
 * Component này render 1 lần khi app mount.
 */
function AntdAppSetup({ children }: { children: ReactNode }) {
  const { message, notification, modal } = App.useApp();
  setAntdInstances(message, notification, modal);
  return <>{children}</>;
}

/**
 * Provider cho Ant Design — cấu hình theme, locale cho toàn bộ app.
 * Bọc <App> để enable imperative API (message, notification, modal)
 * qua holder pattern thay vì static methods.
 */
export function AntdProvider({ children }: { children: ReactNode }) {
  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: '#135bec',
          colorBgLayout: '#f6f6f8',
          colorBgContainer: '#ffffff',
          colorBorder: '#dbe2ea',
          colorText: '#0f172a',
          colorTextSecondary: '#64748b',
          borderRadius: 8,
          borderRadiusLG: 12,
          boxShadow: '0 16px 40px rgba(15, 23, 42, 0.08), 0 6px 18px rgba(15, 23, 42, 0.04)',
          boxShadowSecondary:
            '0 12px 32px rgba(19, 91, 236, 0.12), 0 2px 10px rgba(19, 91, 236, 0.08)',
          controlHeight: 42,
          controlHeightLG: 48,
        },
        components: {
          Button: {
            fontWeight: 700,
            borderRadius: 8,
            boxShadow: 'none',
          },
          Card: {
            borderRadiusLG: 12,
          },
          Drawer: {
            colorBgElevated: '#ffffff',
          },
          Input: {
            borderRadius: 8,
            activeBorderColor: '#135bec',
            hoverBorderColor: '#135bec',
          },
          Modal: {
            borderRadiusLG: 12,
          },
        },
      }}
    >
      <App>
        <AntdAppSetup>{children}</AntdAppSetup>
      </App>
    </ConfigProvider>
  );
}
