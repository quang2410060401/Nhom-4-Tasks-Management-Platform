import { useMemo, useState } from 'react';
import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  PieChartOutlined,
  UnorderedListOutlined,
} from '@ant-design/icons';
import { Alert } from 'antd';
import { normalizeApiError } from '@/services/http';
import { useGroupDashboard } from '@/features/dashboard/hooks';
import {
  OverviewAttentionTasksCard,
  OverviewHeroCard,
  OverviewRecentTasksCard,
  OverviewStatCard,
  OverviewStatusBreakdownCard,
  OverviewWorkloadCard,
} from '@/features/group-detail/components';
import { useGroupDetailLayoutContext } from '@/features/group-detail/types';
import {
  EditGroupModal,
  InviteMemberModal,
  useDeleteGroup,
} from '@/features/groups';

export default function GroupOverviewPage() {
  const { groupId, group } = useGroupDetailLayoutContext();
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const deleteGroupMutation = useDeleteGroup(groupId);
  const dashboardQuery = useGroupDashboard(groupId);

  const dashboardError = useMemo(
    () =>
      dashboardQuery.error ? normalizeApiError(dashboardQuery.error).message : null,
    [dashboardQuery.error],
  );

  const statCards = useMemo(
    () => [
      {
        key: 'total',
        title: 'Tổng công việc',
        value: String(dashboardQuery.data?.totalTasks ?? 0),
        description: 'Số lượng task hiện có trong nhóm.',
        icon: <UnorderedListOutlined />,
        toneClassName: 'bg-primary/10 text-primary',
      },
      {
        key: 'completed',
        title: 'Đã hoàn thành',
        value: String(dashboardQuery.data?.completedTasks ?? 0),
        description: 'Task nằm ở các cột đã đánh dấu hoàn tất.',
        icon: <CheckCircleOutlined />,
        toneClassName: 'bg-emerald-100 text-emerald-600',
      },
      {
        key: 'overdue',
        title: 'Quá hạn',
        value: String(dashboardQuery.data?.overdueCount ?? 0),
        description: 'Task quá deadline nhưng chưa hoàn thành.',
        icon: <ClockCircleOutlined />,
        toneClassName: 'bg-rose-100 text-rose-600',
      },
      {
        key: 'rate',
        title: 'Tỷ lệ hoàn thành',
        value: `${dashboardQuery.data?.completionRate ?? 0}%`,
        description: 'Tính theo toàn bộ công việc trong nhóm.',
        icon: <PieChartOutlined />,
        toneClassName: 'bg-amber-100 text-amber-600',
      },
    ],
    [
      dashboardQuery.data?.completedTasks,
      dashboardQuery.data?.completionRate,
      dashboardQuery.data?.overdueCount,
      dashboardQuery.data?.totalTasks,
    ],
  );

  return (
    <div className="space-y-4">
      <OverviewHeroCard
        group={group}
        isDeleting={deleteGroupMutation.isPending}
        onEdit={() => setIsEditModalOpen(true)}
        onInvite={() => setIsInviteModalOpen(true)}
        onDelete={() => deleteGroupMutation.mutateAsync()}
      />

      {dashboardError ? (
        <Alert
          type="warning"
          showIcon
          message="Không thể tải dữ liệu tổng quan"
          description={dashboardError}
          className="rounded-xl border border-amber-200 bg-amber-50"
        />
      ) : null}

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {statCards.map((card) => (
          <OverviewStatCard
            key={card.key}
            title={card.title}
            value={card.value}
            description={card.description}
            icon={card.icon}
            toneClassName={card.toneClassName}
            loading={dashboardQuery.isLoading}
          />
        ))}
      </section>

      <section className="grid gap-3 xl:grid-cols-2">
        <OverviewStatusBreakdownCard
          items={dashboardQuery.data?.statusBreakdown ?? []}
          totalTasks={dashboardQuery.data?.totalTasks ?? 0}
          loading={dashboardQuery.isLoading}
        />
        <OverviewWorkloadCard
          items={dashboardQuery.data?.tasksByAssignee ?? []}
          loading={dashboardQuery.isLoading}
        />
      </section>

      <section className="grid gap-3 xl:grid-cols-2">
        <OverviewRecentTasksCard
          groupId={groupId}
          tasks={dashboardQuery.data?.recentTasks ?? []}
          loading={dashboardQuery.isLoading}
        />
        <OverviewAttentionTasksCard
          groupId={groupId}
          tasks={dashboardQuery.data?.attentionTasks ?? []}
          loading={dashboardQuery.isLoading}
        />
      </section>

      {group.permissions.canInviteMembers ? (
        <InviteMemberModal
          groupId={groupId}
          open={isInviteModalOpen}
          onClose={() => setIsInviteModalOpen(false)}
        />
      ) : null}

      {group.permissions.canEditGroup ? (
        <EditGroupModal
          open={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          groupId={groupId}
          group={group}
        />
      ) : null}
    </div>
  );
}
