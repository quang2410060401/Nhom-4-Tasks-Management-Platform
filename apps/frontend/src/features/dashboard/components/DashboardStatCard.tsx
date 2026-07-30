import type { ReactNode } from 'react';
import clsx from 'clsx';

interface DashboardStatCardProps {
  title: string;
  value: number;
  description: string;
  icon: ReactNode;
  tone?: 'default' | 'warning' | 'danger' | 'success';
}

const TONE_CLASSNAMES: Record<
  NonNullable<DashboardStatCardProps['tone']>,
  { wrapper: string; icon: string }
> = {
  default: {
    wrapper: 'border-slate-200 bg-white',
    icon: 'bg-primary/10 text-primary',
  },
  warning: {
    wrapper: 'border-amber-200 bg-amber-50/70',
    icon: 'bg-amber-100 text-amber-600',
  },
  danger: {
    wrapper: 'border-rose-200 bg-rose-50/70',
    icon: 'bg-rose-100 text-rose-600',
  },
  success: {
    wrapper: 'border-emerald-200 bg-emerald-50/70',
    icon: 'bg-emerald-100 text-emerald-600',
  },
};

export function DashboardStatCard({
  title,
  value,
  description,
  icon,
  tone = 'default',
}: DashboardStatCardProps) {
  const toneClasses = TONE_CLASSNAMES[tone];

  return (
    <div
      className={clsx(
        'rounded-2xl border px-5 py-4 shadow-sm transition hover:-translate-y-0.5',
        toneClasses.wrapper,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-2">
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">
            {title}
          </p>
          <p className="text-[28px] font-black leading-none tracking-tight text-slate-950">
            {value}
          </p>
          <p className="text-xs text-slate-500">{description}</p>
        </div>

        <div
          className={clsx(
            'flex h-11 w-11 items-center justify-center rounded-2xl text-lg',
            toneClasses.icon,
          )}
        >
          {icon}
        </div>
      </div>
    </div>
  );
}
