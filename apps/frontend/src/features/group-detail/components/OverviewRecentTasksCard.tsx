import { Button, Empty, Tag, Skeleton } from 'antd';
import { ArrowRightOutlined, CalendarOutlined, UserOutlined } from '@ant-design/icons';
import { Link } from 'react-router-dom';
import type { TaskOverviewItem } from '@/types';
import { groupDetailTabPath } from '@/lib/constants/routes';
import { formatDate, formatRelative } from '@/lib/utils/formatDate';

interface OverviewRecentTasksCardProps {
  groupId: string;
  tasks: TaskOverviewItem[];
  loading?: boolean;
}

export function OverviewRecentTasksCard({
  groupId,
  tasks,
  loading = false,
}: OverviewRecentTasksCardProps) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white px-4 py-4 shadow-sm shadow-slate-200/40">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-black tracking-tight text-slate-950">Công việc mới nhất</h2>
          <p className="mt-1 text-sm text-slate-500">Top 5 công việc mới nhất trong nhóm.</p>
        </div>

        <Link to={groupDetailTabPath(groupId, 'tasks')}>
          <Button type="link" className="px-0 font-semibold">
            Xem tất cả
          </Button>
        </Link>
      </div>

      {loading ? (
        <Skeleton active paragraph={{ rows: 4 }} title={false} />
      ) : tasks.length === 0 ? (
        <div className="py-4">
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có công việc nào" />
        </div>
      ) : (
        <div className="divide-y divide-slate-100">
          {tasks.map((task) => (
            <div
              key={task.taskId}
              className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-sm font-semibold text-slate-900 !mb-1">
                    {task.title}
                  </p>
                  <Tag
                    className="m-0 rounded-full border-none px-2.5 py-0.5 text-[11px] font-semibold"
                    style={{ backgroundColor: `${task.status.color}1A`, color: task.status.color }}
                  >
                    {task.status.name}
                  </Tag>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                  <span className="inline-flex items-center gap-1.5">
                    <UserOutlined />
                    {task.assignee?.name || 'Chưa giao'}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <CalendarOutlined />
                    Tạo {formatRelative(task.createdAt)}
                  </span>
                  {task.deadline ? <span>Hạn {formatDate(task.deadline)}</span> : null}
                </div>
              </div>

              <Link
                to={groupDetailTabPath(groupId, 'tasks')}
                className="mt-0.5 shrink-0 text-slate-400 transition-colors hover:text-primary"
              >
                <ArrowRightOutlined />
              </Link>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
