import { Empty, Skeleton } from 'antd';
import type { StatusBreakdownItem } from '@/types';

interface OverviewStatusBreakdownCardProps {
  items: StatusBreakdownItem[];
  totalTasks: number;
  loading?: boolean;
}

export function OverviewStatusBreakdownCard({
  items,
  totalTasks,
  loading = false,
}: OverviewStatusBreakdownCardProps) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white px-4 py-4 shadow-sm shadow-slate-200/40">
      <div className="mb-4">
        <h2 className="text-base font-black tracking-tight text-slate-950">Phân bổ trạng thái</h2>
        <p className="mt-1 text-sm text-slate-500">Tỷ trọng công việc theo workflow hiện tại của nhóm.</p>
      </div>

      {loading ? (
        <Skeleton active paragraph={{ rows: 4 }} title={false} />
      ) : items.length === 0 ? (
        <div className="py-4">
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có dữ liệu trạng thái" />
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => {
            const percentage = totalTasks > 0 ? Math.round((item.count / totalTasks) * 1000) / 10 : 0;

            return (
              <div key={item.statusId} className="space-y-1.5">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="truncate text-sm font-semibold text-slate-700">{item.name}</span>
                    {item.isCompleted ? (
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-600">
                        Done
                      </span>
                    ) : null}
                  </div>
                  <span className="shrink-0 text-sm font-semibold text-slate-500">
                    {item.count} • {percentage}%
                  </span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${Math.max(percentage, item.count > 0 ? 4 : 0)}%`,
                      backgroundColor: item.color,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
