import { Button, Empty, Tag, Skeleton } from 'antd';
import {
  AlertOutlined,
  CalendarOutlined,
  ClockCircleOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { Link } from 'react-router-dom';
import type { TaskAttentionItem } from '@/types';
import { groupDetailTabPath } from '@/lib/constants/routes';
import { formatDateTime, formatRelative } from '@/lib/utils/formatDate';

interface OverviewAttentionTasksCardProps {
  groupId: string;
  tasks: TaskAttentionItem[];
  loading?: boolean;
}

export function OverviewAttentionTasksCard({
  groupId,
  tasks,
  loading = false,
}: OverviewAttentionTasksCardProps) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white px-4 py-4 shadow-sm shadow-slate-200/40">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-black tracking-tight text-slate-950">Cần chú ý</h2>
          <p className="mt-1 text-sm text-slate-500">Công việc quá hạn, sắp đến hạn trong ngày.</p>
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
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Không có công việc cần chú ý" />
        </div>
      ) : (
        <div className="divide-y divide-slate-100">
          {tasks.map((task) => (
            <div key={`${task.kind}-${task.taskId}`} className="py-3 first:pt-0 last:pb-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="truncate text-sm font-semibold text-slate-900 !mb-1">{task.title}</p>
                <Tag
                  className="m-0 rounded-full border-none px-2.5 py-0.5 text-[11px] font-semibold"
                  style={{ backgroundColor: `${task.status.color}1A`, color: task.status.color }}
                >
                  {task.status.name}
                </Tag>
                <Tag
                  className="m-0 rounded-full border-none px-2.5 py-0.5 text-[11px] font-bold"
                  color={task.kind === 'overdue' ? 'error' : 'gold'}
                >
                  {task.kind === 'overdue' ? 'Quá hạn' : 'Sắp đến hạn'}
                </Tag>
              </div>

              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                <span className="inline-flex items-center gap-1.5">
                  <UserOutlined />
                  {task.assignee?.name || 'Chưa giao'}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <CalendarOutlined />
                  {task.deadline ? formatDateTime(task.deadline) : '--'}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  {task.kind === 'overdue' ? <AlertOutlined /> : <ClockCircleOutlined />}
                  {task.deadline ? formatRelative(task.deadline) : '--'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
