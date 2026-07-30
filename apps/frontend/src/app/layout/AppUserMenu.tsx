import clsx from 'clsx';
import { Avatar, Dropdown } from 'antd';
import { DownOutlined, LogoutOutlined, UserOutlined } from '@ant-design/icons';
import { useAuth } from '@/app/providers';
import { useLogout } from '@/features/auth/hooks/useLogout';

interface AppUserMenuProps {
  compact?: boolean;
}

function getInitials(name?: string | null): string {
  if (!name) return 'TM';
  const parts = name.trim().split(/\s+/).filter(Boolean).slice(0, 2);

  return parts.map((part) => part[0]?.toUpperCase() ?? '').join('') || 'TM';
}

export function AppUserMenu({ compact = false }: AppUserMenuProps) {
  const { user } = useAuth();
  const { logout } = useLogout();

  return (
    <Dropdown
      trigger={['click']}
      placement={compact ? 'bottomRight' : 'topRight'}
      menu={{
        items: [
          {
            key: 'logout',
            icon: <LogoutOutlined />,
            label: 'Đăng xuất',
          },
        ],
        onClick: ({ key }) => {
          if (key === 'logout') {
            logout();
          }
        },
      }}
    >
      <button
        type="button"
        className={clsx(
          'flex w-full items-center gap-3 rounded-2xl border border-slate-200 bg-white/90 px-3 py-2 text-left shadow-sm shadow-slate-200/50 transition hover:border-slate-300 hover:bg-white',
          compact &&
            'w-auto rounded-xl border-transparent bg-transparent px-2 py-1.5 shadow-none hover:bg-slate-100',
        )}
      >
        <Avatar
          size={compact ? 34 : 40}
          src={user?.avatar ?? undefined}
          icon={<UserOutlined />}
          className="shrink-0 bg-primary/15 text-primary"
        >
          {getInitials(user?.name)}
        </Avatar>
        {!compact && (
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-slate-900 !mb-1">
              {user?.name ?? 'Người dùng'}
            </p>
            <p className="truncate text-xs text-slate-500">
              {user?.email ?? 'Tài khoản đăng nhập'}
            </p>
          </div>
        )}
        {!compact && <DownOutlined className="text-xs text-slate-400" />}
      </button>
    </Dropdown>
  );
}
