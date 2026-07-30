import { Avatar, Empty, Progress, Skeleton } from 'antd';
import { UserOutlined } from '@ant-design/icons';
import type { TasksByAssigneeItem } from '@/types';

interface OverviewWorkloadCardProps {
  items: TasksByAssigneeItem[];
  loading?: boolean;
}

export function OverviewWorkloadCard({ items, loading = false }: OverviewWorkloadCardProps) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white px-4 py-4 shadow-sm shadow-slate-200/40">
      <div className="mb-4">
        <h2 className="text-base font-black tracking-tight text-slate-950">
          Khối lượng theo thành viên
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Theo dõi tiến độ thực hiện của từng người được giao việc.
        </p>
      </div>

      {loading ? (
        <Skeleton active paragraph={{ rows: 4 }} title={false} />
      ) : items.length === 0 ? (
        <div className="py-4">
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có công việc được giao" />
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => {
            const percent = item.total > 0 ? Math.round((item.done / item.total) * 100) : 0;

            return (
              <div
                key={item.userId}
                className="rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-3"
              >
                <div className="flex items-center gap-3">
                  <Avatar
                    size={38}
                    src={item.avatar || undefined}
                    icon={<UserOutlined />}
                    className="shrink-0 bg-primary/10 text-primary"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-semibold text-slate-900 !mb-1">
                        {item.name}
                      </p>
                      <span className="shrink-0 text-xs font-semibold text-slate-500">
                        {item.done}/{item.total}
                      </span>
                    </div>
                    <Progress
                      percent={percent}
                      size="small"
                      strokeColor="#2563EB"
                      trailColor="#E2E8F0"
                      showInfo={false}
                      className="mt-2 mb-0"
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
