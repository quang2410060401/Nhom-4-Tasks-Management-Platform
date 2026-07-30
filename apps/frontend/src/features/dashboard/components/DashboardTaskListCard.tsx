import { Tag } from 'antd';
import { ArrowRightOutlined, ClockCircleOutlined } from '@ant-design/icons';
import clsx from 'clsx';
import { Link } from 'react-router-dom';
import { formatDateTime, formatRelative } from '@/lib/utils/formatDate';
import type { MyDashboardAttentionTaskItem, MyDashboardTaskItem } from '@/types';

interface DashboardTaskListCardProps {
  title: string;
  description: string;
  tasks: Array<MyDashboardTaskItem | MyDashboardAttentionTaskItem>;
  emptyText: string;
  ctaLabel?: string;
  ctaTo?: string;
  onOpenTask: (task: MyDashboardTaskItem | MyDashboardAttentionTaskItem) => void;
  mode?: 'attention' | 'recent';
}

function buildStatusPalette(color: string) {
  return {
    backgroundColor: `${color}16`,
    color,
    borderColor: `${color}32`,
  };
}

export function DashboardTaskListCard({
  title,
  description,
  tasks,
  emptyText,
  ctaLabel,
  ctaTo,
  onOpenTask,
  mode = 'recent',
}: DashboardTaskListCardProps) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white px-5 py-5 shadow-sm">
      <div className="mb-4 ">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-black tracking-tight text-slate-950">{title}</h2>
          {ctaLabel && ctaTo ? (
            <Link
              to={ctaTo}
              className="inline-flex items-center gap-2 text-sm font-semibold text-primary"
            >
              {ctaLabel}
              <ArrowRightOutlined className="text-xs" />
            </Link>
          ) : null}
        </div>

        <p className="mt-1 text-sm text-slate-500">{description}</p>
      </div>

      {tasks.length > 0 ? (
        <div className="space-y-3">
          {tasks.map((task) => {
            const isOverdueAttention = 'kind' in task && task.kind === 'overdue';
            const attentionTone =
              mode === 'attention'
                ? isOverdueAttention
                  ? 'border-rose-200 bg-rose-50/50'
                  : 'border-amber-200 bg-amber-50/50'
                : 'border-slate-200 bg-slate-50/70';

            const attentionLabel =
              mode === 'attention' ? (isOverdueAttention ? 'Quá hạn' : 'Hôm nay') : null;

            return (
              <button
                key={task.taskId}
                type="button"
                onClick={() => onOpenTask(task)}
                className={clsx(
                  'w-full rounded-2xl border px-4 py-3 text-left transition hover:border-primary/30 hover:bg-white !mb-2',
                  attentionTone,
                )}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <Tag
                        className="m-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold"
                        style={buildStatusPalette(task.status.color)}
                      >
                        {task.status.name}
                      </Tag>
                      <span className="truncate text-xs font-semibold text-slate-500">
                        {task.group.name}
                      </span>
                      {attentionLabel ? (
                        <Tag
                          className={clsx(
                            'm-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold',
                            attentionLabel === 'Quá hạn'
                              ? 'border-rose-200 bg-rose-100 text-rose-600'
                              : 'border-amber-200 bg-amber-100 text-amber-700',
                          )}
                        >
                          {attentionLabel}
                        </Tag>
                      ) : null}
                    </div>

                    <p className="line-clamp-2 text-sm font-semibold leading-6 text-slate-900 !mb-1">
                      {task.title}
                    </p>
                  </div>

                  <ArrowRightOutlined className="shrink-0 text-slate-400" />
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                  <span className="inline-flex items-center gap-1.5">
                    <ClockCircleOutlined />
                    {task.deadline ? formatDateTime(task.deadline) : 'Chưa có deadline'}
                  </span>
                  <span>Cập nhật {formatRelative(task.updatedAt)}</span>
                </div>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">
          {emptyText}
        </div>
      )}
    </section>
  );
}
