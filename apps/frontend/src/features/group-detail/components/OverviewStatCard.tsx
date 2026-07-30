import type { ReactNode } from 'react';
import { Skeleton } from 'antd';

interface OverviewStatCardProps {
  title: string;
  value: string;
  description: string;
  icon: ReactNode;
  toneClassName: string;
  loading?: boolean;
}

export function OverviewStatCard({
  title,
  value,
  description,
  icon,
  toneClassName,
  loading = false,
}: OverviewStatCardProps) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white px-4 py-4 shadow-sm shadow-slate-200/40">
      {loading ? (
        <Skeleton active paragraph={{ rows: 2 }} title={false} />
      ) : (
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">{title}</p>
            <p className="mt-2 text-[28px] font-black tracking-tight text-slate-950">{value}</p>
            <p className="mt-1 text-sm text-slate-500">{description}</p>
          </div>
          <div
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-lg ${toneClassName}`}
          >
            {icon}
          </div>
        </div>
      )}
    </section>
  );
}
