import { UsergroupAddOutlined, ProfileOutlined, UnorderedListOutlined } from '@ant-design/icons';
import { Link } from 'react-router-dom';
import { ROUTES } from '@/lib/constants/routes';

interface DashboardHeaderProps {
  userName?: string | null;
}

function getFirstName(name?: string | null) {
  if (!name) {
    return 'anh';
  }

  const parts = name.trim().split(/\s+/);
  return parts[parts.length - 1] || name;
}

export function DashboardHeader({ userName }: DashboardHeaderProps) {
  const firstName = getFirstName(userName);

  return (
    <div className="flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white px-6 py-6 shadow-sm lg:flex-row lg:items-center lg:justify-between">
      <div className="space-y-2">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">Dashboard</p>
        <div className="space-y-1">
          <h1 className="text-[28px] font-black tracking-tight text-slate-950">
            Xin chào, {firstName}
          </h1>
          <p className="max-w-2xl text-sm text-slate-500">
            Tổng quan nhanh các công việc đang được giao cho anh, những việc cần xử lý ngay và
            snapshot theo từng nhóm.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Link
          to={ROUTES.MY_TASKS}
          className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 transition hover:border-primary hover:text-primary"
        >
          <ProfileOutlined />
          Việc của tôi
        </Link>
        <Link
          to={ROUTES.TASKS}
          className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-primary/90"
        >
          <UnorderedListOutlined />
          Board
        </Link>
        <Link
          to={ROUTES.GROUPS}
          className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-primary/90"
        >
          <UsergroupAddOutlined />
          Xem nhóm
        </Link>
      </div>
    </div>
  );
}
