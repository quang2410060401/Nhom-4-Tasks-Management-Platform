import { useMemo, useState } from 'react';
import { Button, Result } from 'antd';
import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  ExclamationCircleOutlined,
  ProfileOutlined,
} from '@ant-design/icons';
import { Link } from 'react-router-dom';
import { AppPageContainer } from '@/app/layout';
import { AppEmpty, AppLoading } from '@/components';
import {
  DashboardGroupSummaryCard,
  DashboardHeader,
  DashboardStatCard,
  DashboardTaskListCard,
  useMyDashboard,
} from '@/features/dashboard';
import { useCurrentUser } from '@/features/auth/hooks/useCurrentUser';
import {
  useGroupDetail,
  useGroupLabels,
  useGroupStatuses,
  useGroups,
} from '@/features/groups';
import { TaskDetailModal } from '@/features/tasks/components/TaskDetailModal';
import { ROUTES } from '@/lib/constants/routes';
import type { BoardColumn } from '@/types';

export default function DashboardPage() {
  const { user } = useCurrentUser();
  const dashboardQuery = useMyDashboard();
  const groupsQuery = useGroups();
  const [selectedTask, setSelectedTask] = useState<{ groupId: string; taskId: string } | null>(
    null,
  );

  const selectedGroupId = selectedTask?.groupId;
  const selectedGroupQuery = useGroupDetail(selectedGroupId ?? undefined);
  const selectedStatusesQuery = useGroupStatuses(
    selectedGroupId ?? undefined,
    Boolean(selectedTask),
  );
  const selectedLabelsQuery = useGroupLabels(selectedGroupId ?? undefined, Boolean(selectedTask));

  const modalStatuses = useMemo<BoardColumn[]>(
    () =>
      (selectedStatusesQuery.data ?? []).map((status) => ({
        ...status,
        tasks: [],
      })),
    [selectedStatusesQuery.data],
  );

  if (dashboardQuery.isLoading || groupsQuery.isLoading) {
    return <AppLoading minHeight={420} tip="Đang tải dashboard cá nhân..." />;
  }

  if (dashboardQuery.isError || groupsQuery.isError) {
    return (
      <AppPageContainer size="wide">
        <Result
          status="error"
          title="Không thể tải dashboard cá nhân"
          subTitle="Vui lòng thử lại sau hoặc tải lại trang."
          extra={
            <Button
              type="primary"
              onClick={() => {
                void dashboardQuery.refetch();
                void groupsQuery.refetch();
              }}
            >
              Thử lại
            </Button>
          }
        />
      </AppPageContainer>
    );
  }

  const myGroups = groupsQuery.data ?? [];
  const data = dashboardQuery.data;

  if (!data) {
    return null;
  }

  if (myGroups.length === 0) {
    return (
      <AppPageContainer size="wide" className="space-y-6">
        <DashboardHeader userName={user?.name} />
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <AppEmpty
            description="Anh chưa có nhóm nào. Tạo hoặc tham gia một nhóm để bắt đầu làm việc với dashboard cá nhân."
          />
          <div className="mt-2 flex justify-center">
            <Link
              to={ROUTES.GROUPS}
              className="inline-flex h-10 items-center rounded-xl bg-primary px-4 text-sm font-semibold text-white"
            >
              Đi đến danh sách nhóm
            </Link>
          </div>
        </div>
      </AppPageContainer>
    );
  }

  const hasAssignedTasks = data.summary.assignedTasks > 0;

  return (
    <AppPageContainer size="wide" className="space-y-6">
      <DashboardHeader userName={user?.name} />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <DashboardStatCard
          title="Đang được giao"
          value={data.summary.assignedTasks}
          description={`${data.summary.groupCount} nhóm đang có việc của anh`}
          icon={<ProfileOutlined />}
        />
        <DashboardStatCard
          title="Đến hạn hôm nay"
          value={data.summary.dueTodayCount}
          description="Các việc cần hoàn thành trong hôm nay"
          icon={<ClockCircleOutlined />}
          tone="warning"
        />
        <DashboardStatCard
          title="Quá hạn"
          value={data.summary.overdueCount}
          description="Các việc cần xử lý ngay"
          icon={<ExclamationCircleOutlined />}
          tone="danger"
        />
        <DashboardStatCard
          title="Đã hoàn thành"
          value={data.summary.completedTasks}
          description="Các việc anh đã hoàn tất"
          icon={<CheckCircleOutlined />}
          tone="success"
        />
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <DashboardTaskListCard
          title="Cần chú ý"
          description="Các công việc quá hạn hoặc đến hạn trong hôm nay."
          tasks={data.attentionTasks}
          emptyText="Hiện không có công việc nào cần chú ý."
          ctaLabel="Việc của tôi"
          ctaTo={ROUTES.MY_TASKS}
          mode="attention"
          onOpenTask={(task) =>
            setSelectedTask({ groupId: task.group.groupId, taskId: task.taskId })
          }
        />
        <DashboardTaskListCard
          title="Cập nhật gần đây"
          description="Những công việc anh vừa tương tác hoặc mới được cập nhật gần nhất."
          tasks={data.recentTasks}
          emptyText="Chưa có công việc nào được cập nhật gần đây."
          ctaLabel="Xem tất cả"
          ctaTo={ROUTES.MY_TASKS}
          onOpenTask={(task) =>
            setSelectedTask({ groupId: task.group.groupId, taskId: task.taskId })
          }
        />
      </section>

      <section className="space-y-4 rounded-3xl border border-slate-200 bg-white px-5 py-5 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-black tracking-tight text-slate-950">Theo nhóm của tôi</h2>
            <p className="mt-1 text-sm text-slate-500">
              Snapshot nhanh theo từng nhóm mà anh đang có công việc được giao.
            </p>
          </div>
          <Link to={ROUTES.GROUPS} className="text-sm font-semibold text-primary">
            Xem tất cả nhóm
          </Link>
        </div>

        {hasAssignedTasks ? (
          <div className="space-y-4">
            {data.groups.map((group) => (
              <DashboardGroupSummaryCard key={group.groupId} group={group} />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-12">
            <AppEmpty
              description="Chưa có công việc nào được giao cho anh. Khi có task được assign, dashboard sẽ tự tổng hợp các việc cần chú ý và snapshot theo từng nhóm."
            />
            <div className="mt-2 flex justify-center">
              <Link
                to={ROUTES.MY_TASKS}
                className="inline-flex h-10 items-center rounded-xl bg-primary px-4 text-sm font-semibold text-white"
              >
                Mở việc của tôi
              </Link>
            </div>
          </div>
        )}
      </section>

      {selectedTask ? (
        <TaskDetailModal
          key={`${selectedTask.groupId}:${selectedTask.taskId}`}
          groupId={selectedTask.groupId}
          taskId={selectedTask.taskId}
          open={Boolean(selectedTask)}
          onClose={() => setSelectedTask(null)}
          statuses={modalStatuses}
          labels={selectedLabelsQuery.data ?? []}
          members={selectedGroupQuery.data?.members ?? []}
          canManageTaskContent={selectedGroupQuery.data?.permissions.canManageTasks ?? false}
          canDeleteTask={
            selectedGroupQuery.data?.viewerRole === 'owner' ||
            selectedGroupQuery.data?.viewerRole === 'admin'
          }
        />
      ) : null}
    </AppPageContainer>
  );
}
