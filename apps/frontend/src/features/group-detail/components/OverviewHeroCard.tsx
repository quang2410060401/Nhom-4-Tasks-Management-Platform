import { Button, Tag } from 'antd';
import {
  CalendarOutlined,
  DeleteOutlined,
  EditOutlined,
  TeamOutlined,
  UserAddOutlined,
} from '@ant-design/icons';
import type { GroupDetail } from '@/types';
import { ConfirmAction } from '@/components';
import { formatDate } from '@/lib/utils/formatDate';

interface OverviewHeroCardProps {
  group: GroupDetail;
  isDeleting?: boolean;
  onEdit: () => void;
  onInvite: () => void;
  onDelete: () => Promise<void> | void;
}

export function OverviewHeroCard({
  group,
  isDeleting = false,
  onEdit,
  onInvite,
  onDelete,
}: OverviewHeroCardProps) {
  const timelineLabel =
    group.startDate || group.endDate
      ? `Bắt đầu ${formatDate(group.startDate) || '--'} • Kết thúc ${formatDate(group.endDate) || '--'}`
      : `Tạo ngày ${formatDate(group.createdAt)}`;

  return (
    <section className="rounded-xl border border-slate-200 bg-white px-4 py-4 shadow-sm shadow-slate-200/50 md:px-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="flex min-w-0 gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-[22px] text-primary">
            <TeamOutlined />
          </div>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-[28px] font-black tracking-tight text-slate-950">
                {group.name}
              </h1>
              <Tag className="m-0 rounded-full border-none bg-slate-100 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500">
                {group.viewerRole}
              </Tag>
              {group.pendingInviteCount > 0 ? (
                <Tag className="m-0 rounded-full border-none bg-amber-100 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-amber-700">
                  {group.pendingInviteCount} lời mời chờ
                </Tag>
              ) : null}
            </div>

            <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">
              {group.description?.trim() || 'Nhóm này chưa có mô tả chi tiết.'}
            </p>

            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm font-medium text-slate-500">
              <span className="inline-flex items-center gap-2">
                <CalendarOutlined />
                {timelineLabel}
              </span>
              <span className="inline-flex items-center gap-2">
                <TeamOutlined />
                {group.memberCount} thành viên
              </span>
            </div>
          </div>
        </div>

        <div className="flex w-full flex-col gap-2 xl:w-auto xl:min-w-[220px]">
          <div className="flex flex-wrap gap-2 xl:justify-end">
            {group.permissions.canDeleteGroup ? (
              <ConfirmAction
                title={`Xóa nhóm ${group.name}?`}
                content="Toàn bộ thành viên, lời mời, tasks, statuses và labels của nhóm sẽ bị xóa vĩnh viễn."
                okText="Xóa nhóm"
                onConfirm={onDelete}
              >
                <Button
                  danger
                  size="middle"
                  icon={<DeleteOutlined />}
                  loading={isDeleting}
                  className="h-9 rounded-lg px-4 text-sm font-semibold"
                >
                  Xóa nhóm
                </Button>
              </ConfirmAction>
            ) : null}

            {group.permissions.canEditGroup ? (
              <Button
                size="middle"
                icon={<EditOutlined />}
                onClick={onEdit}
                className="h-9 rounded-lg px-4 text-sm font-semibold"
              >
                Chỉnh sửa
              </Button>
            ) : null}
          </div>

          {group.permissions.canInviteMembers ? (
            <Button
              type="primary"
              size="middle"
              icon={<UserAddOutlined />}
              onClick={onInvite}
              className="h-9 rounded-lg px-4 text-sm font-semibold"
            >
              Mời thành viên
            </Button>
          ) : null}
        </div>
      </div>
    </section>
  );
}
