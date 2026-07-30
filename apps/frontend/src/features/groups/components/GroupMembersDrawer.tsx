import { Avatar, Button, Drawer, Tag } from 'antd';
import { MailOutlined, TeamOutlined } from '@ant-design/icons';
import { ConfirmAction } from '@/components';
import { formatDate } from '@/lib/utils/formatDate';
import type { MemberListItemViewModel, PendingInviteListItemViewModel } from '../types';

interface GroupMembersDrawerProps {
  open: boolean;
  onClose: () => void;
  members: MemberListItemViewModel[];
  invites: PendingInviteListItemViewModel[];
  currentUserId?: string;
  isOwner: boolean;
  removingUserId?: string;
  resendingEmail?: string;
  onRemoveMember: (userId: string) => void;
  onResendInvite: (email: string) => void;
}

export function GroupMembersDrawer({
  open,
  onClose,
  members,
  invites,
  currentUserId,
  isOwner,
  removingUserId,
  resendingEmail,
  onRemoveMember,
  onResendInvite,
}: GroupMembersDrawerProps) {
  return (
    <Drawer
      open={open}
      onClose={onClose}
      width={420}
      title={<span className="text-lg font-bold text-slate-950">Thành viên nhóm</span>}
    >
      <div className="space-y-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-400">
            Đã tham gia
          </p>
        </div>
        {members.map((member) => {
          const canRemove = isOwner && member.userId !== currentUserId && member.role !== 'owner';
          const isRemoving = removingUserId === member.userId;

          return (
            <div
              key={member.userId}
              className="rounded-3xl border border-slate-200 bg-white px-4 py-4 shadow-sm shadow-slate-200/60"
            >
              <div className="flex items-start gap-3">
                <Avatar
                  size={44}
                  src={member.avatar ?? undefined}
                  className="bg-primary/15 text-primary"
                >
                  {member.initials}
                </Avatar>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-base font-bold text-slate-950">{member.name}</p>
                    <Tag
                      bordered={false}
                      className={
                        member.isOwner
                          ? 'm-0 rounded-full bg-primary/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-primary'
                          : 'm-0 rounded-full bg-slate-100 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500'
                      }
                    >
                      {member.role}
                    </Tag>
                    <Tag
                      bordered={false}
                      className="m-0 rounded-full bg-emerald-100 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-emerald-700"
                    >
                      Accepted
                    </Tag>
                    {member.userId === currentUserId && (
                      <Tag
                        bordered={false}
                        className="m-0 rounded-full bg-emerald-100 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-emerald-700"
                      >
                        You
                      </Tag>
                    )}
                  </div>

                  <div className="mt-2 space-y-1.5 text-sm text-slate-500">
                    <div className="flex items-center gap-2">
                      <MailOutlined />
                      <span className="truncate">{member.email}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <TeamOutlined />
                      <span>Tham gia từ {formatDate(member.joinedAt)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {canRemove && (
                <div className="mt-4 flex justify-end border-t border-slate-100 pt-4">
                  <ConfirmAction
                    title={`Xóa ${member.name} khỏi nhóm?`}
                    content="Người dùng sẽ bị gỡ khỏi nhóm và các task đang được giao sẽ trở về trạng thái chưa assign."
                    okText="Xóa thành viên"
                    onConfirm={() => onRemoveMember(member.userId)}
                  >
                    <Button danger type="text" loading={isRemoving}>
                      Xóa khỏi nhóm
                    </Button>
                  </ConfirmAction>
                </div>
              )}
            </div>
          );
        })}

        {invites.length > 0 && (
          <>
            <div className="pt-2">
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-400">
                Lời mời đang chờ
              </p>
            </div>

            {invites.map((invite) => {
              const isResending = resendingEmail === invite.email;

              return (
                <div
                  key={invite.email}
                  className="rounded-3xl border border-slate-200 bg-white px-4 py-4 shadow-sm shadow-slate-200/60"
                >
                  <div className="flex items-start gap-3">
                    <Avatar size={44} className="bg-amber-100 text-amber-700">
                      {invite.initials}
                    </Avatar>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-base font-bold text-slate-950">
                          {invite.displayName}
                        </p>
                        <Tag className="m-0 rounded-full border-none bg-amber-100 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-amber-700">
                          Pending
                        </Tag>
                      </div>

                      <div className="mt-2 space-y-1.5 text-sm text-slate-500">
                        <div className="flex items-center gap-2">
                          <MailOutlined />
                          <span className="truncate">{invite.email}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <TeamOutlined />
                          <span>Đã mời từ {formatDate(invite.invitedAt)}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {isOwner && (
                    <div className="mt-4 flex justify-end border-t border-slate-100 pt-4">
                      <Button
                        type="default"
                        loading={isResending}
                        onClick={() => onResendInvite(invite.email)}
                      >
                        Gửi lại lời mời
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </>
        )}
      </div>
    </Drawer>
  );
}
