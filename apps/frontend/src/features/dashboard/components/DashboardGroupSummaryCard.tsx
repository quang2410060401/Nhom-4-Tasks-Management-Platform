import { Progress, Tag } from 'antd';
import { ArrowRightOutlined, CalendarOutlined } from '@ant-design/icons';
import { Link } from 'react-router-dom';
import { formatDateTime } from '@/lib/utils/formatDate';
import { groupDetailTabPath } from '@/lib/constants/routes';
import type { MyDashboardGroupItem } from '@/types';

interface DashboardGroupSummaryCardProps {
  group: MyDashboardGroupItem;
}

function renderRoleLabel(role: MyDashboardGroupItem['role']) {
  switch (role) {
    case 'owner':
      return 'Owner';
    case 'admin':
      return 'Admin';
    default:
      return 'Member';
  }
}

export function DashboardGroupSummaryCard({ group }: DashboardGroupSummaryCardProps) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-5 py-5 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-lg font-black tracking-tight text-slate-950">
              {group.name}
            </h3>
            <Tag className="m-0 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-500">
              {renderRoleLabel(group.role)}
            </Tag>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-xl bg-slate-50 px-3 py-2.5">
              <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">
                Được giao
              </p>
              <p className="mt-1 text-xl font-black text-slate-950">{group.assignedTasks}</p>
            </div>
            <div className="rounded-xl bg-slate-50 px-3 py-2.5">
              <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">
                Mở
              </p>
              <p className="mt-1 text-xl font-black text-slate-950">{group.openTasks}</p>
            </div>
            <div className="rounded-xl bg-amber-50 px-3 py-2.5">
              <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-amber-500">
                Đến hạn hôm nay
              </p>
              <p className="mt-1 text-xl font-black text-amber-700">{group.dueTodayCount}</p>
            </div>
            <div className="rounded-xl bg-rose-50 px-3 py-2.5">
              <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-rose-500">
                Quá hạn
              </p>
              <p className="mt-1 text-xl font-black text-rose-700">{group.overdueCount}</p>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-100 bg-slate-50/80 px-4 py-3">
            <div className="mb-2 flex items-center justify-between gap-3">
              <span className="text-sm font-semibold text-slate-700">Tỷ lệ hoàn thành của tôi</span>
              <span className="text-sm font-bold text-slate-900">{group.completionRate}%</span>
            </div>
            <Progress
              percent={group.completionRate}
              showInfo={false}
              strokeColor="#2563EB"
              trailColor="#E2E8F0"
            />
            <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
              <CalendarOutlined />
              {group.nextDeadline
                ? `Deadline gần nhất: ${formatDateTime(group.nextDeadline)}`
                : 'Hiện chưa có deadline mở'}
            </div>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Link
            to={`/tasks?groupId=${encodeURIComponent(group.groupId)}`}
            className="inline-flex h-9 items-center rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-700 transition hover:border-primary hover:text-primary"
          >
            Mở board
          </Link>
          <Link
            to={groupDetailTabPath(group.groupId, 'overview')}
            className="inline-flex h-9 items-center gap-2 rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-700 transition hover:border-primary hover:text-primary"
          >
            Chi tiết nhóm
            <ArrowRightOutlined className="text-xs" />
          </Link>
        </div>
      </div>
    </div>
  );
}
