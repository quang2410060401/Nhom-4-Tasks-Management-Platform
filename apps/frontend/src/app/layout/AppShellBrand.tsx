import clsx from 'clsx';

interface AppShellBrandProps {
  compact?: boolean;
}

export function AppShellBrand({ compact = false }: AppShellBrandProps) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex size-11 items-center justify-center rounded-2xl bg-primary text-white shadow-lg shadow-primary/20">
        <svg
          className="size-6"
          fill="none"
          viewBox="0 0 48 48"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M24 5C13.5 5 5 13.5 5 24s8.5 19 19 19 19-8.5 19-19S34.5 5 24 5Zm9.1 14.7-10.4 11c-.6.7-1.7.7-2.4.1l-5.4-4.9a1.7 1.7 0 0 1 2.3-2.4l4.2 3.8 9.2-9.8a1.7 1.7 0 0 1 2.5 2.2Z"
            fill="currentColor"
          />
        </svg>
      </div>
      {!compact && (
        <div>
          <p className="text-[1.55rem] font-black tracking-tight text-slate-950">TaskMaster</p>
          <p className={clsx('text-sm text-slate-500', compact && 'hidden')}>Workspace</p>
        </div>
      )}
    </div>
  );
}
