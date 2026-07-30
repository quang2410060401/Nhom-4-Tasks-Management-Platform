import type { ReactNode } from 'react';
import clsx from 'clsx';
import {
  DashboardOutlined,
  ProfileOutlined,
  TeamOutlined,
  UnorderedListOutlined,
} from '@ant-design/icons';
import { Link, useLocation } from 'react-router-dom';
import { ROUTES } from '@/lib/constants/routes';
import { AppUserMenu } from './AppUserMenu';
import AppLogo from '@/components/common/AppLogo';

interface AppSidebarProps {
  className?: string;
  onNavigate?: () => void;
}

interface AppNavItem {
  key: string;
  icon: ReactNode;
  label: string;
  to: string;
  isActive: (pathname: string) => boolean;
}

const NAV_ITEMS: AppNavItem[] = [
  {
    key: 'dashboard',
    icon: <DashboardOutlined />,
    label: 'Dashboard',
    to: ROUTES.DASHBOARD,
    isActive: (pathname) => pathname === ROUTES.HOME || pathname === ROUTES.DASHBOARD,
  },
  {
    key: 'groups',
    icon: <TeamOutlined />,
    label: 'Groups',
    to: ROUTES.GROUPS,
    isActive: (pathname) =>
      pathname.startsWith('/groups') || pathname.startsWith(ROUTES.INVITE_ACCEPT),
  },
  {
    key: 'tasks',
    icon: <UnorderedListOutlined />,
    label: 'Board',
    to: ROUTES.TASKS,
    isActive: (pathname) => pathname === ROUTES.TASKS,
  },
  {
    key: 'my-tasks',
    icon: <ProfileOutlined />,
    label: 'My Tasks',
    to: ROUTES.MY_TASKS,
    isActive: (pathname) => pathname === ROUTES.MY_TASKS,
  },
];

export function AppSidebar({ className, onNavigate }: AppSidebarProps) {
  const location = useLocation();

  return (
    <aside
      className={clsx(
        'flex h-full flex-col border-r border-slate-200 bg-white/95 backdrop-blur',
        className,
      )}
    >
      <div className="border-b border-slate-200 px-6 py-6">
        <Link to={ROUTES.DASHBOARD} onClick={onNavigate} className="inline-flex">
          <AppLogo />
        </Link>
      </div>

      <nav className="flex-1 px-4 py-6">
        <div className="space-y-1.5">
          {NAV_ITEMS.map((item) => {
            const active = item.isActive(location.pathname);

            return (
              <Link
                key={item.key}
                to={item.to}
                onClick={onNavigate}
                className={clsx(
                  'flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold transition',
                  active
                    ? 'bg-primary/10 text-primary shadow-sm shadow-primary/10'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
                )}
              >
                <span className="text-lg">{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      <div className="border-t border-slate-200 px-4 py-4">
        <AppUserMenu />
      </div>
    </aside>
  );
}
