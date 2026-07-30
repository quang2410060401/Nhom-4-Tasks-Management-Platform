import { useEffect, useMemo, useState } from 'react';
import { Button, DatePicker, Input, Popover, Result, Select, Table, Tag } from 'antd';
import { CalendarOutlined, FilterOutlined, SearchOutlined, TeamOutlined } from '@ant-design/icons';
import clsx from 'clsx';
import dayjs from 'dayjs';
import { Link, useSearchParams } from 'react-router-dom';
import { AppPageContainer } from '@/app/layout';
import { AppEmpty, AppLoading } from '@/components';
import { TaskDetailModal } from '@/features/tasks/components/TaskDetailModal';
import { useGroupDetail, useGroupLabels, useGroupStatuses } from '@/features/groups';
import { useMyTasks } from '@/features/tasks';
import type { MyTaskFilters } from '@/features/tasks';
import { groupDetailTabPath, ROUTES } from '@/lib/constants/routes';
import { formatDate, formatDateTime, formatRelative } from '@/lib/utils/formatDate';
import { normalizeApiError } from '@/services/http';
import type {
  BoardColumn,
  MyTaskGroupSection,
  MyTaskLabelFilterOption,
  MyTaskStatusFilterOption,
} from '@/types';

function parseCsv(value: string | null): string[] {
  return value
    ? value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
    : [];
}

function cloneFilters(filters: MyTaskFilters): MyTaskFilters {
  return {
    q: filters.q,
    groupIds: [...(filters.groupIds ?? [])],
    statusIds: [...(filters.statusIds ?? [])],
    labelIds: [...(filters.labelIds ?? [])],
    dateFrom: filters.dateFrom,
    dateTo: filters.dateTo,
  };
}

function areFiltersEqual(left: MyTaskFilters, right: MyTaskFilters) {
  return (
    (left.q ?? '') === (right.q ?? '') &&
    (left.dateFrom ?? '') === (right.dateFrom ?? '') &&
    (left.dateTo ?? '') === (right.dateTo ?? '') &&
    (left.groupIds ?? []).join(',') === (right.groupIds ?? []).join(',') &&
    (left.statusIds ?? []).join(',') === (right.statusIds ?? []).join(',') &&
    (left.labelIds ?? []).join(',') === (right.labelIds ?? []).join(',')
  );
}

function buildStatusPalette(color: string) {
  return {
    backgroundColor: `${color}16`,
    color,
    borderColor: `${color}30`,
  };
}

function useMyTaskSearchState() {
  const [searchParams, setSearchParams] = useSearchParams();

  const filters: MyTaskFilters = {
    q: searchParams.get('q') || undefined,
    groupIds: parseCsv(searchParams.get('groupIds')),
    statusIds: parseCsv(searchParams.get('statusIds')),
    labelIds: parseCsv(searchParams.get('labelIds')),
    dateFrom: searchParams.get('dateFrom') || undefined,
    dateTo: searchParams.get('dateTo') || undefined,
  };

  const updateParams = (updates: Record<string, string | string[] | null | undefined>) => {
    const next = new URLSearchParams(searchParams);

    Object.entries(updates).forEach(([key, value]) => {
      if (Array.isArray(value)) {
        if (value.length > 0) {
          next.set(key, value.join(','));
        } else {
          next.delete(key);
        }
        return;
      }

      if (value) {
        next.set(key, value);
      } else {
        next.delete(key);
      }
    });

    setSearchParams(next, { replace: true });
  };

  return { filters, updateParams };
}

function buildStatusOptions(options: MyTaskStatusFilterOption[]) {
  return options.map((option) => ({
    value: option.statusId,
    rawLabel: `${option.groupName} • ${option.name}`,
    color: option.color,
    itemName: option.name,
    groupName: option.groupName,
    label: (
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: option.color }} />
          <span className="font-medium text-slate-700">{option.name}</span>
        </div>
        <span className="text-xs text-slate-400">{option.groupName}</span>
      </div>
    ),
  }));
}

function buildLabelOptions(options: MyTaskLabelFilterOption[]) {
  return options.map((option) => ({
    value: option.labelId,
    rawLabel: `${option.groupName} • ${option.name}`,
    color: option.color,
    itemName: option.name,
    groupName: option.groupName,
    label: (
      <div className="flex items-center justify-between gap-3">
        <Tag
          className="m-0 rounded-full border px-2 py-0.5 text-xs font-semibold"
          style={buildStatusPalette(option.color)}
        >
          {option.name}
        </Tag>
        <span className="text-xs text-slate-400">{option.groupName}</span>
      </div>
    ),
  }));
}

export default function MyTasksPage() {
  const { filters, updateParams } = useMyTaskSearchState();
  const [searchValue, setSearchValue] = useState(filters.q ?? '');
  const [isFilterPopoverOpen, setIsFilterPopoverOpen] = useState(false);
  const [draftFilters, setDraftFilters] = useState<MyTaskFilters>(() => cloneFilters(filters));
  const [selectedTask, setSelectedTask] = useState<{ groupId: string; taskId: string } | null>(
    null,
  );
  const myTasksQuery = useMyTasks(filters);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      const normalized = searchValue.trim();
      if (normalized === (filters.q ?? '')) {
        return;
      }

      updateParams({ q: normalized || null });
    }, 500);

    return () => window.clearTimeout(timeout);
  }, [filters.q, searchValue, updateParams]);

  const data = myTasksQuery.data;
  const activeFilterTags = useMemo(() => {
    if (!data) {
      return [];
    }

    const tags: Array<{ key: string; label: string }> = [];

    if (filters.q) {
      tags.push({ key: 'q', label: `Tên: ${filters.q}` });
    }

    if (filters.groupIds?.length) {
      const names = data.filterOptions.groups
        .filter((group) => filters.groupIds?.includes(group.groupId))
        .map((group) => group.name);

      if (names.length > 0) {
        tags.push({ key: 'groups', label: `Nhóm: ${names.join(', ')}` });
      }
    }

    if (filters.statusIds?.length) {
      const names = data.filterOptions.statuses
        .filter((status) => filters.statusIds?.includes(status.statusId))
        .map((status) => `${status.groupName} • ${status.name}`);

      if (names.length > 0) {
        tags.push({ key: 'statuses', label: `Trạng thái: ${names.join(', ')}` });
      }
    }

    if (filters.labelIds?.length) {
      const names = data.filterOptions.labels
        .filter((label) => filters.labelIds?.includes(label.labelId))
        .map((label) => `${label.groupName} • ${label.name}`);

      if (names.length > 0) {
        tags.push({ key: 'labels', label: `Labels: ${names.join(', ')}` });
      }
    }

    if (filters.dateFrom && filters.dateTo) {
      tags.push({
        key: 'date',
        label: `Ngày: ${formatDate(filters.dateFrom)} - ${formatDate(filters.dateTo)}`,
      });
    }

    return tags;
  }, [data, filters]);

  const hasFilterChanges = useMemo(
    () => !areFiltersEqual(draftFilters, filters),
    [draftFilters, filters],
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

  if (myTasksQuery.isLoading) {
    return <AppLoading minHeight={420} tip="Đang tải danh sách công việc của anh..." />;
  }

  if (myTasksQuery.error) {
    const error = normalizeApiError(myTasksQuery.error);

    return (
      <AppPageContainer size="wide">
        <Result status="error" title="Không thể tải danh sách công việc" subTitle={error.message} />
      </AppPageContainer>
    );
  }

  if (!data) {
    return <AppLoading minHeight={420} tip="Đang chuẩn bị dữ liệu công việc..." />;
  }

  const hasAnyTasks = data.filterOptions.groups.length > 0;
  const hasVisibleTasks = data.groups.length > 0;
  const statusOptions = buildStatusOptions(data.filterOptions.statuses);
  const labelOptions = buildLabelOptions(data.filterOptions.labels);
  const statusOptionMap = new Map(
    data.filterOptions.statuses.map((option) => [option.statusId, option]),
  );
  const labelOptionMap = new Map(
    data.filterOptions.labels.map((option) => [option.labelId, option]),
  );

  const resetDraftFilters = () => {
    setDraftFilters({
      q: filters.q,
      groupIds: [],
      statusIds: [],
      labelIds: [],
      dateFrom: undefined,
      dateTo: undefined,
    });
  };

  const applyDraftFilters = () => {
    updateParams({
      groupIds: draftFilters.groupIds ?? [],
      statusIds: draftFilters.statusIds ?? [],
      labelIds: draftFilters.labelIds ?? [],
      dateFrom: draftFilters.dateFrom ?? null,
      dateTo: draftFilters.dateTo ?? null,
    });
    setIsFilterPopoverOpen(false);
  };

  return (
    <AppPageContainer size="wide" className="space-y-4">
      <section>
        <p className="!mb-3 text-sm font-bold uppercase tracking-[0.18em] text-primary">My Tasks</p>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex w-full gap-3 lg:max-w-[540px] lg:items-start">
            <Input
              allowClear
              value={searchValue}
              onChange={(event) => setSearchValue(event.target.value)}
              prefix={<SearchOutlined className="text-slate-400" />}
              placeholder="Tìm nhanh theo tên công việc"
              className="w-full lg:max-w-[360px]"
            />
            <div className="flex items-center gap-2">
              <Popover
                open={isFilterPopoverOpen}
                onOpenChange={(open) => {
                  setIsFilterPopoverOpen(open);
                  if (open) {
                    setDraftFilters(cloneFilters(filters));
                  }
                }}
                trigger="click"
                placement="bottomRight"
                content={
                  <div className="w-[360px] space-y-3">
                    <div>
                      <p className="text-sm font-bold text-slate-950">Bộ lọc công việc</p>
                    </div>

                    <div className="space-y-1.5">
                      <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-slate-400">
                        Nhóm
                      </p>
                      <Select
                        mode="multiple"
                        allowClear
                        value={draftFilters.groupIds}
                        onChange={(value) =>
                          setDraftFilters((current) => ({ ...current, groupIds: value }))
                        }
                        placeholder="Chọn nhóm"
                        className="w-full"
                        options={data.filterOptions.groups.map((group) => ({
                          value: group.groupId,
                          label: `${group.name}`,
                        }))}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-slate-400">
                        Trạng thái
                      </p>
                      <Select
                        mode="multiple"
                        allowClear
                        value={draftFilters.statusIds}
                        onChange={(value) =>
                          setDraftFilters((current) => ({ ...current, statusIds: value }))
                        }
                        placeholder="Chọn trạng thái"
                        optionLabelProp="rawLabel"
                        className="w-full"
                        options={statusOptions}
                        tagRender={({ value, closable, onClose }) => {
                          const option = statusOptionMap.get(String(value));
                          return (
                            <Tag
                              closable={closable}
                              onClose={onClose}
                              className="my-[2px] rounded-full border px-2 py-0.5 text-xs font-semibold"
                              style={option ? buildStatusPalette(option.color) : undefined}
                            >
                              {option ? `${option.groupName} • ${option.name}` : value}
                            </Tag>
                          );
                        }}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-slate-400">
                        Labels
                      </p>
                      <Select
                        mode="multiple"
                        allowClear
                        value={draftFilters.labelIds}
                        onChange={(value) =>
                          setDraftFilters((current) => ({ ...current, labelIds: value }))
                        }
                        placeholder="Chọn labels"
                        optionLabelProp="rawLabel"
                        className="w-full"
                        options={labelOptions}
                        tagRender={({ value, closable, onClose }) => {
                          const option = labelOptionMap.get(String(value));
                          return (
                            <Tag
                              closable={closable}
                              onClose={onClose}
                              className="my-[2px] rounded-full border px-2 py-0.5 text-xs font-semibold"
                              style={option ? buildStatusPalette(option.color) : undefined}
                            >
                              {option ? `${option.groupName} • ${option.name}` : value}
                            </Tag>
                          );
                        }}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-slate-400">
                        Ngày đến hạn
                      </p>
                      <DatePicker.RangePicker
                        className="w-full"
                        value={
                          draftFilters.dateFrom && draftFilters.dateTo
                            ? [dayjs(draftFilters.dateFrom), dayjs(draftFilters.dateTo)]
                            : null
                        }
                        onChange={(dates) =>
                          setDraftFilters((current) => ({
                            ...current,
                            dateFrom: dates?.[0]
                              ? dates[0].startOf('day').toISOString()
                              : undefined,
                            dateTo: dates?.[1] ? dates[1].endOf('day').toISOString() : undefined,
                          }))
                        }
                      />
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-1">
                      <Button size="small" onClick={resetDraftFilters}>
                        Reset
                      </Button>
                      <Button
                        size="small"
                        type="primary"
                        disabled={!hasFilterChanges}
                        onClick={applyDraftFilters}
                      >
                        Apply
                      </Button>
                    </div>
                  </div>
                }
              >
                <Button
                  icon={<FilterOutlined />}
                  type={activeFilterTags.length > 0 ? 'default' : 'text'}
                  className={clsx(
                    'h-10 rounded-lg px-4 text-sm font-semibold',
                    activeFilterTags.length > 0 && 'bg-primary/5 text-primary',
                  )}
                >
                  {activeFilterTags.length > 0 ? `Bộ lọc (${activeFilterTags.length})` : 'Bộ lọc'}
                </Button>
              </Popover>
            </div>
          </div>
        </div>

        {activeFilterTags.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
            {activeFilterTags.map((item) => (
              <Tag
                key={item.key}
                className="m-0 rounded-full border-none bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600"
              >
                {item.label}
              </Tag>
            ))}
            <Button
              type="link"
              size="small"
              className="px-0 text-xs font-semibold"
              onClick={() => {
                setSearchValue('');
                updateParams({
                  q: null,
                  groupIds: [],
                  statusIds: [],
                  labelIds: [],
                  dateFrom: null,
                  dateTo: null,
                });
              }}
            >
              Xóa bộ lọc
            </Button>
          </div>
        )}
      </section>

      {!hasAnyTasks ? (
        <section className="rounded-2xl border border-slate-200 bg-white px-6 py-12 shadow-sm shadow-slate-200/50">
          <AppEmpty description="Hiện chưa có công việc nào được giao cho anh.">
            <Link to={ROUTES.TASKS}>
              <Button type="primary">Đi tới board công việc</Button>
            </Link>
          </AppEmpty>
        </section>
      ) : !hasVisibleTasks ? (
        <section className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-10 shadow-sm shadow-slate-200/50">
          <AppEmpty description="Không có công việc nào phù hợp với bộ lọc hiện tại." />
        </section>
      ) : (
        <div className="space-y-4">
          {data.groups.map((section) => (
            <MyTaskGroupSectionCard
              key={section.group.groupId}
              section={section}
              onOpenTask={(taskId) => setSelectedTask({ groupId: section.group.groupId, taskId })}
            />
          ))}
        </div>
      )}

      {selectedTask && (
        <TaskDetailModal
          key={`${selectedTask.groupId}:${selectedTask.taskId}`}
          groupId={selectedTask.groupId}
          taskId={selectedTask.taskId}
          open={Boolean(selectedTask)}
          onClose={() => setSelectedTask(null)}
          canManageTaskContent={selectedGroupQuery.data?.permissions.canManageTasks ?? false}
          canDeleteTask={
            selectedGroupQuery.data?.viewerRole === 'owner' ||
            selectedGroupQuery.data?.viewerRole === 'admin'
          }
          statuses={modalStatuses}
          labels={selectedLabelsQuery.data ?? []}
          members={selectedGroupQuery.data?.members ?? []}
        />
      )}
    </AppPageContainer>
  );
}

function MyTaskGroupSectionCard({
  section,
  onOpenTask,
}: {
  section: MyTaskGroupSection;
  onOpenTask: (taskId: string) => void;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm shadow-slate-200/50">
      <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="!mb-0 text-lg font-bold text-slate-950">{section.group.name}</h2>
            <Tag className="m-0 rounded-full border-none bg-slate-100 px-2.5 py-1 text-[11px] font-bold uppercase text-slate-500">
              {section.group.role}
            </Tag>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-sm text-slate-500">
            <span className="inline-flex items-center gap-1.5">
              <TeamOutlined />
              {section.group.memberCount} thành viên
            </span>
            <span>{section.total} công việc được giao cho tôi</span>
          </div>
        </div>

        <Link to={groupDetailTabPath(section.group.groupId, 'tasks')}>
          <Button size="small">Vào công việc của nhóm</Button>
        </Link>
      </div>

      <Table
        rowKey="taskId"
        dataSource={section.tasks}
        pagination={false}
        className="[&_.ant-table-cell]:align-middle [&_.ant-table-thead>tr>th]:bg-slate-50 [&_.ant-table-thead>tr>th]:text-xs [&_.ant-table-thead>tr>th]:font-bold [&_.ant-table-thead>tr>th]:uppercase [&_.ant-table-thead>tr>th]:tracking-[0.08em]"
        columns={[
          {
            title: 'Công việc',
            dataIndex: 'title',
            render: (_value, record) => (
              <button type="button" className="text-left" onClick={() => onOpenTask(record.taskId)}>
                <p className="!mb-1 text-sm font-semibold text-slate-950 hover:text-primary">
                  {record.title}
                </p>
                <p className="text-xs text-slate-400">
                  Cập nhật {formatRelative(record.updatedAt)}
                </p>
              </button>
            ),
          },
          {
            title: 'Trạng thái',
            dataIndex: 'status',
            width: 180,
            render: (status: MyTaskGroupSection['tasks'][number]['status']) => (
              <Tag
                className="m-0 rounded-full border px-2.5 py-1 text-xs font-semibold"
                style={buildStatusPalette(status.color)}
              >
                {status.name}
              </Tag>
            ),
          },
          {
            title: 'Đến hạn',
            dataIndex: 'deadline',
            width: 220,
            render: (deadline: string | null, record) =>
              deadline ? (
                <div>
                  <p
                    className={clsx(
                      '!mb-1 text-sm font-semibold',
                      !record.status.isCompleted && dayjs(deadline).isBefore(dayjs())
                        ? 'text-red-500'
                        : 'text-slate-900',
                    )}
                  >
                    {formatDateTime(deadline)}
                  </p>
                  <p className="text-xs text-slate-400">
                    <CalendarOutlined className="mr-1" />
                    {formatRelative(deadline)}
                  </p>
                </div>
              ) : (
                <span className="text-sm text-slate-400">Chưa có hạn</span>
              ),
          },
          {
            title: 'Labels',
            dataIndex: 'labels',
            render: (labels: MyTaskGroupSection['tasks'][number]['labels']) =>
              labels.length > 0 ? (
                <div className="flex flex-wrap gap-1">
                  {labels.map((label) => (
                    <Tag
                      key={label._id}
                      className="m-0 rounded-full border px-2 py-0.5 text-xs font-semibold"
                      style={buildStatusPalette(label.color)}
                    >
                      {label.name}
                    </Tag>
                  ))}
                </div>
              ) : (
                <span className="text-sm text-slate-400">Không có</span>
              ),
          },
          {
            title: 'Tạo lúc',
            dataIndex: 'createdAt',
            width: 180,
            render: (createdAt: string) => (
              <div>
                <p className="!mb-1 text-sm font-medium text-slate-700">{formatDate(createdAt)}</p>
                <p className="text-xs text-slate-400">{formatRelative(createdAt)}</p>
              </div>
            ),
          },
        ]}
      />
    </section>
  );
}
