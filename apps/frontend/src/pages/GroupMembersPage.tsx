import { useMemo, useState } from 'react';
import { Avatar, Button, Empty, Input, Select, Table, Tag } from 'antd';
import {
  DeleteOutlined,
  SearchOutlined,
  UserAddOutlined,
  UserDeleteOutlined,
} from '@ant-design/icons';
import clsx from 'clsx';
import { useSearchParams } from 'react-router-dom';
import { ConfirmAction } from '@/components';
import {
  buildMemberListItemViewModel,
  buildPendingInviteListItemViewModel,
  InviteMemberModal,
  useInviteMember,
  useRemoveMember,
  useRevokeInvite,
  useUpdateMemberRole,
} from '@/features/groups';
import type { PendingInviteListItemViewModel } from '@/features/groups/types';
import { useGroupDetailLayoutContext, type MemberRoleFilter } from '@/features/group-detail/types';
import { formatDateTime, formatRelative } from '@/lib/utils/formatDate';

function matchesSearch(text: string, keyword: string) {
  return text.toLowerCase().includes(keyword.toLowerCase());
}

const ROLE_FILTER_OPTIONS: Array<{ value: MemberRoleFilter; label: string }> = [
  { value: 'all', label: 'Tất cả' },
  { value: 'admin', label: 'Quản trị viên' },
  { value: 'member', label: 'Thành viên' },
  { value: 'pending', label: 'Đang chờ' },
];

function getRoleLabel(role: 'owner' | 'admin' | 'member') {
  if (role === 'owner') return 'Owner';
  if (role === 'admin') return 'Admin';
  return 'Member';
}

function getRoleTagClassName(role: 'owner' | 'admin' | 'member') {
  if (role === 'owner' || role === 'admin') {
    return 'bg-primary/10 text-primary';
  }

  return 'bg-slate-100 text-slate-600';
}

export default function GroupMembersPage() {
  const { groupId, group } = useGroupDetailLayoutContext();
  const [searchParams, setSearchParams] = useSearchParams();
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const removeMemberMutation = useRemoveMember(groupId);
  const resendInviteMutation = useInviteMember(groupId);
  const revokeInviteMutation = useRevokeInvite(groupId);
  const updateMemberRoleMutation = useUpdateMemberRole(groupId);
  const keyword = searchParams.get('q')?.trim() ?? '';
  const roleFilter = (searchParams.get('role') as MemberRoleFilter | null) ?? 'all';

  const members = useMemo(() => group.members.map(buildMemberListItemViewModel), [group.members]);
  const invites = useMemo(
    () => group.invites.map(buildPendingInviteListItemViewModel),
    [group.invites],
  );

  const filteredMembers = members.filter((member) => {
    const matchesKeyword = !keyword || matchesSearch(`${member.name} ${member.email}`, keyword);
    const matchesRole =
      roleFilter === 'all' ||
      (roleFilter === 'admin' && member.isManager) ||
      (roleFilter === 'member' && member.role === 'member');

    return matchesKeyword && matchesRole;
  });

  const filteredInvites = invites.filter((invite) => {
    const matchesKeyword =
      !keyword || matchesSearch(`${invite.displayName} ${invite.email}`, keyword);
    const matchesRole =
      roleFilter === 'all' ||
      roleFilter === 'pending' ||
      (roleFilter === 'admin' && invite.role === 'admin') ||
      (roleFilter === 'member' && invite.role === 'member');

    return matchesKeyword && matchesRole;
  });

  const pendingColumns = [
    {
      title: 'Thông tin',
      key: 'identity',
      render: (_: unknown, invite: PendingInviteListItemViewModel) => (
        <div>
          <p className="font-semibold text-slate-950">{invite.email}</p>
          <p className="text-sm text-slate-500">
            Vai trò: {invite.role === 'admin' ? 'Quản trị viên' : 'Thành viên'}
          </p>
        </div>
      ),
    },
    {
      title: 'Ngày mời',
      dataIndex: 'invitedAt',
      key: 'invitedAt',
      render: (value: string) => (
        <div>
          <p className="text-sm font-medium text-slate-700">{formatDateTime(value)}</p>
          <p className="mt-0.5 text-xs text-slate-400">{formatRelative(value)}</p>
        </div>
      ),
    },
    {
      title: 'Thao tác',
      align: 'right' as const,
      key: 'actions',
      render: (_: unknown, invite: PendingInviteListItemViewModel) => (
        <div className="flex items-center justify-end gap-2">
          {group.permissions.canInviteMembers && (
            <Button
              type="link"
              className="px-0 text-sm font-semibold"
              loading={
                resendInviteMutation.isPending &&
                resendInviteMutation.variables?.email === invite.email
              }
              onClick={() =>
                resendInviteMutation.mutate({
                  email: invite.email,
                  role: invite.role === 'admin' ? 'admin' : 'member',
                })
              }
            >
              Gửi lại
            </Button>
          )}
          {group.permissions.canManageMembers && (
            <ConfirmAction
              title="Thu hồi lời mời?"
              content={`Lời mời gửi tới ${invite.email} sẽ bị vô hiệu hóa.`}
              okText="Thu hồi"
              onConfirm={async () => {
                await revokeInviteMutation.mutateAsync(invite._id);
              }}
            >
              <Button
                type="text"
                icon={<DeleteOutlined />}
                loading={
                  revokeInviteMutation.isPending && revokeInviteMutation.variables === invite._id
                }
                className="h-9 w-9 rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              />
            </ConfirmAction>
          )}
        </div>
      ),
    },
  ];

  return (
    <section className="space-y-5">
      <section className="space-y-2">
        <div className="flex items-center gap-2 justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-[26px] font-black tracking-tight text-slate-950 !mb-0">
              Thành viên
            </h2>
            <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-sm font-bold text-slate-500">
              {group.memberCount}
            </span>
          </div>
          {group.permissions.canInviteMembers ? (
            <Button
              type="primary"
              icon={<UserAddOutlined />}
              onClick={() => setIsInviteModalOpen(true)}
              className="h-9 rounded-lg px-4 text-sm font-semibold"
            >
              Mời thành viên
            </Button>
          ) : null}
        </div>

        <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <Input
              allowClear
              value={keyword}
              prefix={<SearchOutlined className="text-slate-400" />}
              placeholder="Tìm theo tên hoặc email"
              onChange={(event) => {
                const params = new URLSearchParams(searchParams);
                const nextValue = event.target.value.trim();
                if (nextValue) {
                  params.set('q', nextValue);
                } else {
                  params.delete('q');
                }
                setSearchParams(params, { replace: true });
              }}
              className="w-full max-w-[320px]"
            />
          </div>
          <div className="inline-flex flex-wrap rounded-xl border border-slate-200 bg-slate-50 p-1">
            {ROLE_FILTER_OPTIONS.map((option) => (
              <Button
                key={option.value}
                type={roleFilter === option.value ? 'primary' : 'text'}
                className="h-9 rounded-lg px-4 text-sm font-semibold"
                onClick={() => {
                  const params = new URLSearchParams(searchParams);
                  if (option.value === 'all') {
                    params.delete('role');
                  } else {
                    params.set('role', option.value);
                  }
                  setSearchParams(params, { replace: true });
                }}
              >
                {option.label}
              </Button>
            ))}
          </div>
        </div>
      </section>

      {roleFilter !== 'pending' && (
        <section className="grid gap-4 xl:grid-cols-2">
          {filteredMembers.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-5 py-9 xl:col-span-2">
              <Empty description="Không tìm thấy thành viên phù hợp" />
            </div>
          ) : (
            filteredMembers.map((member) => (
              <div
                key={member.userId}
                className="flex flex-col gap-4 rounded-[22px] border border-slate-200 bg-white px-5 py-5 md:flex-row md:items-center md:justify-between"
              >
                <div className="flex min-w-0 items-center gap-4">
                  <div className={clsx('flex shrink-0 rounded-full')}>
                    <Avatar
                      size={56}
                      src={member.avatar ?? undefined}
                      className="bg-primary/15 font-semibold text-primary"
                    >
                      {member.initials}
                    </Avatar>
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-[18px] font-bold text-slate-950">{member.name}</p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2 text-sm">
                      <Tag
                        className={`m-0 rounded-md border-none px-2.5 py-0.5 text-[11px] font-bold uppercase ${getRoleTagClassName(member.role)}`}
                      >
                        {getRoleLabel(member.role)}
                      </Tag>
                      <span className="text-slate-500">
                        Tham gia {formatRelative(member.joinedAt)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {group.permissions.canManageRoles && !member.isOwner && (
                    <Select
                      value={member.role === 'admin' ? 'admin' : 'member'}
                      size="small"
                      className="min-w-[126px] [&_.ant-select-selector]:rounded-full [&_.ant-select-selector]:border-slate-200"
                      popupMatchSelectWidth={false}
                      onChange={(value: 'admin' | 'member') =>
                        updateMemberRoleMutation.mutate({
                          userId: member.userId,
                          payload: { role: value },
                        })
                      }
                      loading={
                        updateMemberRoleMutation.isPending &&
                        updateMemberRoleMutation.variables?.userId === member.userId
                      }
                      options={[
                        { value: 'member', label: 'Thành viên' },
                        { value: 'admin', label: 'Quản trị viên' },
                      ]}
                    />
                  )}

                  {group.permissions.canManageMembers && !member.isOwner && (
                    <ConfirmAction
                      title={`Xóa ${member.name} khỏi nhóm?`}
                      content="Người dùng sẽ bị gỡ khỏi nhóm và các task được giao sẽ bị bỏ assign."
                      okText="Xóa thành viên"
                      onConfirm={() => removeMemberMutation.mutateAsync(member.userId)}
                    >
                      <Button
                        type="text"
                        icon={<UserDeleteOutlined />}
                        loading={
                          removeMemberMutation.isPending &&
                          removeMemberMutation.variables === member.userId
                        }
                        className="h-10 w-10 rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                      />
                    </ConfirmAction>
                  )}
                </div>
              </div>
            ))
          )}
        </section>
      )}

      <section className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <h3 className="text-[20px] font-black tracking-tight text-slate-950">
            Đang chờ phản hồi
          </h3>
          <span className="rounded-full bg-amber-100 px-3 py-1 text-sm font-bold text-amber-700">
            {filteredInvites.length} lời mời
          </span>
        </div>

        <section className="rounded-[22px] border border-slate-200 bg-white">
          <Table
            rowKey="_id"
            dataSource={filteredInvites}
            columns={pendingColumns}
            locale={{ emptyText: 'Không có lời mời đang chờ' }}
            pagination={{
              pageSize: 5,
              showSizeChanger: false,
              position: ['bottomCenter'],
            }}
            className="[&_.ant-pagination]:py-4 [&_.ant-table-cell]:align-middle [&_.ant-table-tbody>tr>td]:py-5 [&_.ant-table-thead>tr>th]:bg-slate-50 [&_.ant-table-thead>tr>th]:text-xs [&_.ant-table-thead>tr>th]:font-bold [&_.ant-table-thead>tr>th]:uppercase [&_.ant-table-thead>tr>th]:tracking-[0.08em]"
          />
        </section>
      </section>

      {group.permissions.canInviteMembers ? (
        <InviteMemberModal
          groupId={groupId}
          open={isInviteModalOpen}
          onClose={() => setIsInviteModalOpen(false)}
        />
      ) : null}
    </section>
  );
}
