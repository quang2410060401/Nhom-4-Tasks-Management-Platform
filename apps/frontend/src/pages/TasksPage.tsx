import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Result, Select } from 'antd';
import { Link, useSearchParams } from 'react-router-dom';
import { AppPageContainer } from '@/app/layout';
import { AppEmpty, AppLoading } from '@/components';
import { useGroupDetail, useGroups } from '@/features/groups';
import { ROUTES } from '@/lib/constants/routes';
import { normalizeApiError } from '@/services/http';
import { TaskWorkspace } from './GroupTasksPage';

const LAST_SELECTED_GROUP_STORAGE_KEY = 'tasks:standalone:last-group-id';
const GROUP_SCOPED_SEARCH_PARAM_KEYS = [
  'q',
  'assigneeId',
  'assigneeIds',
  'statusIds',
  'labelIds',
  'dateFrom',
  'dateTo',
] as const;

export default function TasksPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const groupsQuery = useGroups();
  const [lastSelectedGroupId] = useState<string | null>(() => {
    if (typeof window === 'undefined') {
      return null;
    }

    return window.localStorage.getItem(LAST_SELECTED_GROUP_STORAGE_KEY);
  });

  const groups = useMemo(
    () =>
      (groupsQuery.data ?? [])
        .slice()
        .sort(
          (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
        ),
    [groupsQuery.data],
  );

  const groupIdFromUrl = searchParams.get('groupId');
  const hasValidGroupIdFromUrl = Boolean(
    groupIdFromUrl && groups.some((group) => group._id === groupIdFromUrl),
  );

  const selectedGroupId = useMemo(() => {
    if (hasValidGroupIdFromUrl) {
      return groupIdFromUrl!;
    }

    if (lastSelectedGroupId && groups.some((group) => group._id === lastSelectedGroupId)) {
      return lastSelectedGroupId;
    }

    return groups[0]?._id ?? null;
  }, [groupIdFromUrl, groups, hasValidGroupIdFromUrl, lastSelectedGroupId]);

  const selectedGroupSummary = useMemo(
    () => groups.find((group) => group._id === selectedGroupId) ?? null,
    [groups, selectedGroupId],
  );

  const groupDetailQuery = useGroupDetail(selectedGroupId ?? undefined);

  const replaceSearchParamsForGroup = useCallback(
    (nextGroupId: string, resetScopedFilters: boolean) => {
      const nextParams = new URLSearchParams(searchParams);
      nextParams.set('groupId', nextGroupId);

      if (resetScopedFilters) {
        GROUP_SCOPED_SEARCH_PARAM_KEYS.forEach((key) => nextParams.delete(key));
      }

      setSearchParams(nextParams, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  useEffect(() => {
    if (!selectedGroupId) {
      return;
    }

    if (groupIdFromUrl !== selectedGroupId) {
      replaceSearchParamsForGroup(selectedGroupId, true);
      return;
    }

    if (typeof window !== 'undefined') {
      window.localStorage.setItem(LAST_SELECTED_GROUP_STORAGE_KEY, selectedGroupId);
    }
  }, [groupIdFromUrl, replaceSearchParamsForGroup, searchParams, selectedGroupId, setSearchParams]);

  if (groupsQuery.isLoading) {
    return <AppLoading minHeight={420} tip="Đang tải không gian công việc..." />;
  }

  if (groupsQuery.error) {
    const error = normalizeApiError(groupsQuery.error);

    return (
      <AppPageContainer size="wide">
        <Result
          status="error"
          title="Không thể tải danh sách nhóm"
          subTitle={error.message}
          extra={
            <Link to={ROUTES.GROUPS}>
              <Button type="primary">Quay lại danh sách nhóm</Button>
            </Link>
          }
        />
      </AppPageContainer>
    );
  }

  if (groups.length === 0) {
    return (
      <AppPageContainer size="wide">
        <AppEmpty description="Anh chưa tham gia nhóm nào để thao tác công việc.">
          <Link to={ROUTES.GROUPS}>
            <Button type="primary">Đi tới danh sách nhóm</Button>
          </Link>
        </AppEmpty>
      </AppPageContainer>
    );
  }

  if (!selectedGroupId || !selectedGroupSummary) {
    return <AppLoading minHeight={420} tip="Đang chuẩn bị board công việc..." />;
  }

  if (groupDetailQuery.isLoading || !groupDetailQuery.data) {
    if (groupDetailQuery.error) {
      const error = normalizeApiError(groupDetailQuery.error);

      return (
        <AppPageContainer size="wide">
          <Result
            status="error"
            title="Không thể tải board công việc"
            subTitle={error.message}
            extra={
              <Link to={ROUTES.GROUPS}>
                <Button type="primary">Quay lại danh sách nhóm</Button>
              </Link>
            }
          />
        </AppPageContainer>
      );
    }

    return <AppLoading minHeight={420} tip="Đang tải thông tin nhóm..." />;
  }

  const group = groupDetailQuery.data;

  return (
    <AppPageContainer size="wide" className="space-y-4">
      <section>
        <div className="flex flex-col gap-8 xl:flex-row xl:items-end xl:justify-between">
          <div className="flex w-full ">
            <p className="text-sm font-bold uppercase tracking-[0.22em] text-primary">Task Board</p>
          </div>
          <div className="flex w-full max-w-[420px] flex-col gap-1 ">
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400 !mb-0">
              Nhóm đang thao tác
            </p>
            <Select
              size="large"
              value={selectedGroupId}
              onChange={(value) => replaceSearchParamsForGroup(value, true)}
              className="w-full"
              options={groups.map((groupItem) => ({
                value: groupItem._id,
                label: `${groupItem.name}`,
              }))}
            />
          </div>
        </div>
      </section>

      <TaskWorkspace key={selectedGroupId} groupId={selectedGroupId} group={group} />
    </AppPageContainer>
  );
}
