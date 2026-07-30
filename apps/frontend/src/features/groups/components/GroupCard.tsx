import { Avatar, Progress, Tag, Tooltip } from 'antd';
import {
  CalendarOutlined,
  ArrowRightOutlined,
  BgColorsOutlined,
  CodeOutlined,
  CustomerServiceOutlined,
  ExperimentOutlined,
  RocketOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import { Link } from 'react-router-dom';
import clsx from 'clsx';
import { formatDate, isOverdue } from '@/lib/utils/formatDate';
import { groupDetailPath } from '@/lib/constants/routes';
import type { GroupCardTone, GroupCardViewModel } from '../types';

interface GroupCardProps {
  group: GroupCardViewModel;
}

const TONE_STYLES: Record<
  GroupCardTone,
  { surface: string; iconColor: string; Icon: typeof BgColorsOutlined }
> = {
  primary: {
    surface: 'from-primary/25 to-primary/5',
    iconColor: 'text-primary/55',
    Icon: BgColorsOutlined,
  },
  indigo: {
    surface: 'from-indigo-400/25 to-indigo-100/40',
    iconColor: 'text-indigo-500/55',
    Icon: CodeOutlined,
  },
  emerald: {
    surface: 'from-emerald-400/25 to-emerald-100/40',
    iconColor: 'text-emerald-500/55',
    Icon: CustomerServiceOutlined,
  },
  amber: {
    surface: 'from-amber-400/25 to-amber-100/40',
    iconColor: 'text-amber-500/55',
    Icon: ExperimentOutlined,
  },
  rose: {
    surface: 'from-rose-400/25 to-rose-100/40',
    iconColor: 'text-rose-500/55',
    Icon: RocketOutlined,
  },
  cyan: {
    surface: 'from-cyan-400/25 to-cyan-100/40',
    iconColor: 'text-cyan-500/55',
    Icon: TeamOutlined,
  },
};

function buildTimelineLabel(group: GroupCardViewModel) {
  if (group.startDate && group.endDate) {
    return `${formatDate(group.startDate)} - ${formatDate(group.endDate)}`;
  }

  if (group.startDate) {
    return `Bắt đầu ${formatDate(group.startDate)}`;
  }

  if (group.endDate) {
    return `Kết thúc ${formatDate(group.endDate)}`;
  }

  return `Tạo ngày ${formatDate(group.createdAt)}`;
}

export function GroupCard({ group }: GroupCardProps) {
  const tone = TONE_STYLES[group.tone];
  const roleLabel = group.role === 'owner' ? 'Owner' : 'Member';
  const isDeadlineOverdue = Boolean(group.endDate && isOverdue(group.endDate));
  const timelineLabel = buildTimelineLabel(group);
  const previewMembers = group.memberPreview.slice(0, 2);
  const visibleAvatarCount = previewMembers.length > 0 ? previewMembers.length : 1;
  const remainingMemberCount = Math.max(group.memberCount - visibleAvatarCount, 0);

  return (
    <article className="group flex h-full flex-col rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/60 transition duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-slate-200/70">
      {/* Header Card */}
      <div
        className={clsx(
          'relative mb-4 h-32 overflow-hidden rounded-[18px] bg-gradient-to-br',
          tone.surface,
        )}
      >
        <div className="absolute inset-0 bg-white/20" />
        <div className="absolute left-3 right-3 top-3 flex items-start justify-between gap-2">
          <Tag
            bordered={false}
            className={clsx(
              'm-0 rounded-full bg-white/85 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] shadow-sm backdrop-blur',
              group.role === 'owner' ? 'text-primary' : 'text-slate-500',
            )}
          >
            {roleLabel}
          </Tag>

          {isDeadlineOverdue ? (
            <Tag
              bordered={false}
              className="m-0 rounded-full bg-red-500/90 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-white shadow-sm"
            >
              Trễ hạn
            </Tag>
          ) : null}
        </div>
        <tone.Icon className={clsx('absolute bottom-3 right-3 text-[1.9rem]', tone.iconColor)} />
      </div>

      <div className="flex flex-1 flex-col">
        <div className="flex items-start justify-between gap-2">
          <Link to={groupDetailPath(group._id)}>
            <h3 className="line-clamp-2 text-lg font-black tracking-tight text-slate-950 transition group-hover:text-primary">
              {group.name}
            </h3>
          </Link>
        </div>

        <p className="mt-2.5 line-clamp-2 text-[13px] leading-5 text-slate-500">{group.summary}</p>

        <div className="mt-2 flex items-center gap-2 text-xs font-medium text-slate-500">
          <CalendarOutlined className="text-slate-400" />
          <span>{timelineLabel}</span>
        </div>

        <div className="mt-2">
          <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
            <span>Tiến độ</span>
            <span className="text-slate-700">{group.completionRate}%</span>
          </div>
          <Progress
            percent={group.completionRate}
            showInfo={false}
            strokeWidth={6}
            strokeColor={isDeadlineOverdue ? '#ef4444' : '#2563eb'}
            trailColor="#e2e8f0"
            className="m-0"
          />
        </div>

        <div className="mt-2 flex items-center justify-between border-t border-slate-100 pt-3">
          <Tooltip title={`${group.memberCount} thành viên`}>
            <div className="flex items-center gap-2.5 text-xs text-slate-500">
              <Avatar.Group size={28}>
                {previewMembers.length > 0 ? (
                  previewMembers.map((member) => (
                    <Avatar
                      key={member.userId}
                      src={member.avatar ?? undefined}
                      className="bg-primary text-xs font-bold"
                    >
                      {!member.avatar ? member.name.trim().charAt(0).toUpperCase() : null}
                    </Avatar>
                  ))
                ) : (
                  <Avatar className="bg-primary text-xs font-bold">
                    {group.name.trim().charAt(0).toUpperCase()}
                  </Avatar>
                )}

                {remainingMemberCount > 0 && (
                  <Avatar
                    className="text-xs font-bold"
                    style={{
                      backgroundColor: '#fff1e6',
                      color: '#f97316',
                    }}
                  >
                    +{remainingMemberCount}
                  </Avatar>
                )}
              </Avatar.Group>
            </div>
          </Tooltip>
          <Link
            to={groupDetailPath(group._id)}
            className="inline-flex items-center gap-2 text-sm font-bold text-primary transition hover:translate-x-0.5"
          >
            Chi tiết
            <ArrowRightOutlined />
          </Link>
        </div>
      </div>
    </article>
  );
}
