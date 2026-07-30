import { LoadingOutlined } from '@ant-design/icons';
import { Spin } from 'antd';

/* ─────────────────────────────────────────────────────────────────
 * AppLoading — loading state component chuẩn hoá
 * ─────────────────────────────────────────────────────────────────
 * Dùng cho:
 * - Fullscreen loading khi chờ auth check
 * - Section loading khi fetch data
 * - Inline loading khi chờ mutation
 * ───────────────────────────────────────────────────────────────── */

interface AppLoadingProps {
  /** Loading tip text */
  tip?: string;
  /** Kích thước spinner */
  size?: 'small' | 'default' | 'large';
  /** Chiều cao tối thiểu container */
  minHeight?: number;
  /** Hiển thị fullscreen overlay */
  fullscreen?: boolean;
}

export function AppLoading({
  tip,
  size = 'large',
  minHeight = 200,
  fullscreen = false,
}: AppLoadingProps) {
  const iconSize = size === 'small' ? 18 : size === 'default' ? 22 : 28;
  const textSize = size === 'small' ? 'text-xs' : 'text-sm';
  const indicator = <LoadingOutlined spin style={{ fontSize: iconSize }} />;

  if (fullscreen) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-50/78 backdrop-blur-sm">
        <div className="flex min-w-[220px] flex-col items-center gap-3 rounded-2xl border border-slate-200 bg-white/96 px-6 py-5 shadow-sm shadow-slate-200/60">
          <Spin indicator={indicator} size={size} />
          {tip ? (
            <p className={`${textSize} font-medium text-slate-500`}>{tip}</p>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center" style={{ minHeight }}>
      <div className="flex min-w-[180px] flex-col items-center gap-3 rounded-2xl border border-dashed border-slate-200 bg-white/85 px-5 py-4">
        <Spin indicator={indicator} size={size} />
        {tip ? (
          <p className={`${textSize} text-center font-medium text-slate-500`}>{tip}</p>
        ) : null}
      </div>
    </div>
  );
}
