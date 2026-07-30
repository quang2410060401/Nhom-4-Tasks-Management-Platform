import { useEffect, useMemo, useState } from 'react';
import {
  Avatar,
  Button,
  DatePicker,
  Form,
  Input,
  Modal,
  Popover,
  Select,
  Table,
  Tag,
  Upload,
} from 'antd';
import {
  AppstoreOutlined,
  CalendarOutlined,
  FilterOutlined,
  InboxOutlined,
  MoreOutlined,
  PlusOutlined,
  SearchOutlined,
  UnorderedListOutlined,
} from '@ant-design/icons';
import {
  DndContext,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import dayjs from 'dayjs';
import clsx from 'clsx';
import { AppLoading } from '@/components';
import { useGroupDetailLayoutContext } from '@/features/group-detail/types';
import { useGroupLabels, useGroupStatuses } from '@/features/groups';
import { formatDate, formatDateTime } from '@/lib/utils/formatDate';
import {
  flattenBoardData,
  mapTaskListResponse,
  type CreateTaskPayload,
  type TaskBoardFilters,
  type TaskListRowViewModel,
  useCreateTask,
  useTaskBoard,
  useTaskList,
  useUpdateTask,
} from '@/features/tasks';
import { useSearchParams } from 'react-router-dom';
import type { UploadFile } from 'antd/es/upload/interface';
import type { BoardColumn, GroupDetail, GroupMember, TaskLabel } from '@/types';
import { uploadTaskAttachmentsApi } from '@/features/tasks/api/taskApi';
import { TaskDetailModal } from '@/features/tasks/components/TaskDetailModal';
import { TaskRichTextEditor } from '@/features/tasks/components/TaskRichTextEditor';
import {
  extractPlainTextFromHtml,
  mapUploadFilesToFiles,
  normalizeRichTextHtml,
  TASK_ALLOWED_EXTENSIONS,
  TASK_ATTACHMENT_MAX_FILES,
  TASK_DESCRIPTION_MAX_TEXT_LENGTH,
  validateAttachmentFile,
  validateFutureDateTime,
  validateTaskDescriptionHtml,
} from '@/features/tasks/utils';
import { normalizeApiError } from '@/services/http';
import { notificationService, showApiError } from '@/services/ui';

const BOARD_COLUMN_MAX_HEIGHT_PX = 680;
const BOARD_COLUMN_HEADER_OFFSET_PX = 44;

function parseCsv(value: string | null): string[] {
  return value
    ? value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
    : [];
}

function countActiveFilters(filters: TaskBoardFilters) {
  return [
    filters.q,
    filters.assigneeIds?.length ? 'assignees' : undefined,
    filters.statusIds?.length ? 'statuses' : undefined,
    filters.labelIds?.length ? 'labels' : undefined,
    filters.dateFrom && filters.dateTo ? 'date' : undefined,
  ].filter(Boolean).length;
}

function cloneTaskFilters(filters: TaskBoardFilters): TaskBoardFilters {
  return {
    q: filters.q,
    assigneeIds: [...(filters.assigneeIds ?? [])],
    statusIds: [...(filters.statusIds ?? [])],
    labelIds: [...(filters.labelIds ?? [])],
    dateFrom: filters.dateFrom,
    dateTo: filters.dateTo,
  };
}

function areTaskFiltersEqual(left: TaskBoardFilters, right: TaskBoardFilters) {
  return (
    (left.q ?? '') === (right.q ?? '') &&
    (left.dateFrom ?? '') === (right.dateFrom ?? '') &&
    (left.dateTo ?? '') === (right.dateTo ?? '') &&
    (left.assigneeIds ?? []).join(',') === (right.assigneeIds ?? []).join(',') &&
    (left.statusIds ?? []).join(',') === (right.statusIds ?? []).join(',') &&
    (left.labelIds ?? []).join(',') === (right.labelIds ?? []).join(',')
  );
}

function toggleFilterId(current: string[] | undefined, value: string, checked: boolean) {
  if (checked) {
    return Array.from(new Set([...(current ?? []), value]));
  }

  return (current ?? []).filter((item) => item !== value);
}

function ToolbarFieldLabel({ children }: { children: string }) {
  return (
    <p className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.08em] text-slate-400">
      {children}
    </p>
  );
}

function normalizeTaskTitleValue(value: string | undefined): string {
  return value?.trim() ?? '';
}

function validateTaskTitle(value: string | undefined): string | null {
  const normalized = normalizeTaskTitleValue(value);
  if (!normalized) {
    return 'Tiêu đề không được để trống';
  }
  if (normalized.length > 200) {
    return 'Tiêu đề tối đa 200 ký tự';
  }
  return null;
}

function buildUploadQueue(
  fileList: UploadFile[],
  existingCount = 0,
): { nextFileList: UploadFile[]; error: string | null } {
  const deduped: UploadFile[] = [];
  let error: string | null = null;

  for (const item of fileList) {
    const file = item.originFileObj;
    if (!file) {
      continue;
    }

    const duplicate = deduped.some((queuedItem) => {
      const queuedFile = queuedItem.originFileObj;
      return (
        queuedFile &&
        queuedFile.name === file.name &&
        queuedFile.size === file.size &&
        queuedFile.lastModified === file.lastModified
      );
    });

    if (duplicate) {
      continue;
    }

    const validationError = validateAttachmentFile(file);
    if (validationError) {
      error = validationError;
      continue;
    }

    if (existingCount + deduped.length >= TASK_ATTACHMENT_MAX_FILES) {
      error = 'Tối đa 10 tệp cho mỗi công việc';
      break;
    }

    deduped.push(item);
  }

  return { nextFileList: deduped, error };
}

const TASK_MODAL_WIDTH = 1160;
const TASK_MODAL_TOP = 24;
const TASK_STATUS_SELECT_CLASSNAME =
  '[&_.ant-select-selector]:!h-11 [&_.ant-select-selector]:!rounded-xl [&_.ant-select-selector]:!border-slate-200 [&_.ant-select-selector]:!px-3 [&_.ant-select-selector]:!py-0 [&_.ant-select-selector]:!shadow-none [&_.ant-select-selection-wrap]:!items-center [&_.ant-select-selection-item]:!font-medium [&_.ant-select-selection-item]:!text-slate-800 [&_.ant-select-arrow]:!text-slate-300';
const TASK_STATUS_SELECT_POPUP_CLASSNAME = 'task-status-select-popup';

type TaskStatusSelectOption = {
  value: string;
  rawLabel: string;
  statusName: string;
  statusColor: string;
  label: string;
};

function buildTagPalette(color: string) {
  return {
    backgroundColor: `${color}16`,
    color,
    borderColor: `${color}32`,
  };
}

function buildStatusOptions(statuses: BoardColumn[]) {
  return statuses.map((status) => ({
    value: status._id,
    rawLabel: status.name,
    statusName: status.name,
    statusColor: status.color,
    label: status.name,
  })) satisfies TaskStatusSelectOption[];
}

function renderStatusSelectContent(
  status:
    | {
        statusName: string;
        statusColor: string;
      }
    | undefined,
  fallback?: string,
) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <span
        className="h-3 w-3 shrink-0 rounded-full"
        style={{ backgroundColor: status?.statusColor ?? '#cbd5e1' }}
      />
      <span className="truncate text-[15px] font-medium text-slate-800">
        {status?.statusName ?? fallback ?? ''}
      </span>
    </span>
  );
}

function renderStatusSelectOptionNode(
  option: TaskStatusSelectOption | undefined,
  fallback?: string,
) {
  return (
    <div className="flex w-full items-center gap-2.5">
      {renderStatusSelectContent(option, fallback)}
    </div>
  );
}

function buildLabelOptions(labels: TaskLabel[]) {
  return labels.map((label) => ({
    value: label._id,
    rawLabel: label.name,
    color: label.color,
    label: (
      <Tag
        className="m-0 rounded-full border px-2 py-0.5 text-xs font-semibold"
        style={buildTagPalette(label.color)}
      >
        {label.name}
      </Tag>
    ),
  }));
}

function useTaskSearchState() {
  const [searchParams, setSearchParams] = useSearchParams();

  const view = searchParams.get('view') === 'list' ? 'list' : 'board';
  const filters: TaskBoardFilters = {
    q: searchParams.get('q') || undefined,
    assigneeIds: parseCsv(searchParams.get('assigneeIds') ?? searchParams.get('assigneeId')),
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

  return { view, filters, updateParams };
}

function TaskCard({
  task,
  statusId,
  onOpen,
}: {
  task: TaskListRowViewModel;
  statusId: string;
  onOpen: (taskId: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task._id,
    data: { statusId },
  });

  return (
    <button
      ref={setNodeRef}
      type="button"
      onClick={() => onOpen(task._id)}
      style={{
        transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
      }}
      className={clsx(
        'w-full rounded-2xl border border-slate-200 bg-white p-3.5 text-left shadow-sm transition-shadow hover:shadow-md !mb-3',
        isDragging && 'opacity-70 shadow-lg',
      )}
      {...listeners}
      {...attributes}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {task.labels.slice(0, 2).map((label) => (
            <Tag
              key={label._id}
              className="m-0 rounded-md border-none px-2.5 py-1 text-[11px] font-bold uppercase"
              style={{ backgroundColor: `${label.color}1A`, color: label.color }}
            >
              {label.name}
            </Tag>
          ))}
        </div>
        <span className="pt-0.5 text-sm text-slate-300">
          <MoreOutlined />
        </span>
      </div>

      <p className="mt-3 text-[17px] font-semibold leading-8 text-slate-950">{task.title}</p>

      <div className="mt-3 flex items-center justify-between gap-3 text-sm text-slate-500">
        <span className="inline-flex items-center gap-2">
          <CalendarOutlined />
          {task.deadline ? formatDateTime(task.deadline) : formatDateTime(task.createdAt)}
        </span>
        <Avatar size={30} src={task.assignee?.avatar ?? undefined}>
          {task.assignee?.name?.slice(0, 2).toUpperCase() ?? '?'}
        </Avatar>
      </div>
    </button>
  );
}

function TaskBoardColumn({
  status,
  tasks,
  onOpenTask,
}: {
  status: BoardColumn;
  tasks: TaskListRowViewModel[];
  onOpenTask: (taskId: string) => void;
}) {
  const { isOver, setNodeRef } = useDroppable({ id: `status:${status._id}` });

  return (
    <div className="min-w-[280px] max-w-[320px] flex-1" style={{ maxHeight: BOARD_COLUMN_MAX_HEIGHT_PX }}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: status.color }} />
          <h3 className="text-[15px] font-black uppercase tracking-tight text-slate-950 !mb-0">
            {status.name}
          </h3>
          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-bold text-slate-500">
            {tasks.length}
          </span>
        </div>
        <span className="text-sm text-slate-300">
          <MoreOutlined />
        </span>
      </div>

      <div
        ref={setNodeRef}
        className={clsx(
          'min-h-[500px] overflow-y-auto rounded-2xl border border-dashed p-2.5 transition-colors',
          isOver ? 'border-primary bg-primary/5' : 'border-slate-200 bg-slate-50/80',
        )}
        style={{ maxHeight: BOARD_COLUMN_MAX_HEIGHT_PX - BOARD_COLUMN_HEADER_OFFSET_PX }}
      >
        <div className="space-y-3 pr-1">
          {tasks.map((task) => (
            <TaskCard key={task._id} task={task} statusId={status._id} onOpen={onOpenTask} />
          ))}
        </div>
      </div>
    </div>
  );
}

function TaskCreateModal({
  open,
  onClose,
  onOpenTask,
  groupId,
  statuses,
  labels,
  members,
  onSubmit,
  loading,
}: {
  open: boolean;
  onClose: () => void;
  onOpenTask: (taskId: string) => void;
  groupId: string;
  statuses: BoardColumn[];
  labels: TaskLabel[];
  members: GroupMember[];
  onSubmit: (payload: CreateTaskPayload) => Promise<{ _id: string }>;
  loading: boolean;
}) {
  const [form] = Form.useForm<CreateTaskPayload>();
  const [descriptionHtml, setDescriptionHtml] = useState<string | null>(null);
  const [descriptionError, setDescriptionError] = useState<string | null>(null);
  const [attachmentQueue, setAttachmentQueue] = useState<UploadFile[]>([]);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [isUploadingAttachments, setIsUploadingAttachments] = useState(false);
  const defaultStatus = useMemo(
    () =>
      statuses.find((status) => status.slug === 'todo') ??
      statuses.find((status) => !status.isCompleted) ??
      statuses[0],
    [statuses],
  );
  const labelOptionMap = useMemo(
    () => new Map(labels.map((label) => [label._id, label])),
    [labels],
  );
  const labelOptions = useMemo(() => buildLabelOptions(labels), [labels]);

  useEffect(() => {
    if (!open) {
      form.resetFields();
      setDescriptionHtml(null);
      setDescriptionError(null);
      setAttachmentQueue([]);
      setAttachmentError(null);
      setIsUploadingAttachments(false);
    }
  }, [form, open]);

  const handleAttachmentChange = (nextList: UploadFile[]) => {
    const { nextFileList, error } = buildUploadQueue(nextList);
    setAttachmentQueue(nextFileList);
    setAttachmentError(error);
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      onOk={async () => {
        const values = await form.validateFields();
        const nextDescriptionError = validateTaskDescriptionHtml(descriptionHtml);
        if (nextDescriptionError) {
          setDescriptionError(nextDescriptionError);
          return;
        }

        const normalizedDescription = normalizeRichTextHtml(descriptionHtml);
        const files = mapUploadFilesToFiles(attachmentQueue);
        const createdTask = await onSubmit({
          title: normalizeTaskTitleValue(values.title),
          description: normalizedDescription,
          assigneeId: values.assigneeId || undefined,
          deadline: values.deadline ? dayjs(values.deadline).toISOString() : undefined,
          labelIds: values.labelIds?.length ? [...new Set(values.labelIds)] : undefined,
        });

        if (files.length > 0) {
          setIsUploadingAttachments(true);
          try {
            await uploadTaskAttachmentsApi(groupId, createdTask._id, files);
          } catch (error) {
            showApiError(normalizeApiError(error));
            notificationService.warning({
              message: 'Công việc đã được tạo',
              description:
                'Tệp đính kèm chưa tải lên thành công. Bạn có thể thử lại trong cửa sổ chi tiết công việc.',
            });
            onOpenTask(createdTask._id);
          } finally {
            setIsUploadingAttachments(false);
          }
        }

        onClose();
      }}
      confirmLoading={loading || isUploadingAttachments}
      title="Tạo công việc"
      okText="Tạo công việc"
      width={TASK_MODAL_WIDTH}
      style={{ top: TASK_MODAL_TOP }}
      destroyOnHidden
    >
      <Form
        form={form}
        layout="vertical"
        className="[&_.ant-form-item]:!mb-3 [&_.ant-form-item-label]:!pb-1"
      >
        <Form.Item
          name="title"
          label="Tiêu đề"
          rules={[
            {
              validator: async (_rule, value) => {
                const error = validateTaskTitle(value);
                if (error) {
                  throw new Error(error);
                }
              },
            },
          ]}
        >
          <Input placeholder="Nhập tiêu đề công việc" />
        </Form.Item>
        <div className="mb-6">
          <p className="mb-2 text-sm font-medium text-slate-700">Mô tả</p>
          <TaskRichTextEditor
            value={descriptionHtml}
            onChange={(value) => {
              setDescriptionHtml(value);
              setDescriptionError(validateTaskDescriptionHtml(value));
            }}
            placeholder="Nhập mô tả công việc"
            error={descriptionError}
          />
          <p className="mt-2 text-xs text-slate-400">
            {extractPlainTextFromHtml(descriptionHtml).length}/{TASK_DESCRIPTION_MAX_TEXT_LENGTH} ký
            tự
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <p className="mb-2 text-sm font-medium text-slate-700">Trạng thái mặc định</p>
            <div className="flex h-10 items-center rounded-xl border border-slate-200 bg-slate-50 px-3">
              {defaultStatus ? (
                <Tag
                  className="m-0 rounded-full border px-2.5 py-1 text-xs font-semibold"
                  style={buildTagPalette(defaultStatus.color)}
                >
                  {defaultStatus.name}
                </Tag>
              ) : (
                <span className="text-sm text-slate-500">Todo</span>
              )}
            </div>
          </div>
          <Form.Item name="assigneeId" label="Người phụ trách">
            <Select
              allowClear
              options={members.map((member) => ({
                value: member.userId,
                label: member.name,
              }))}
            />
          </Form.Item>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Form.Item
            name="deadline"
            label="Hạn hoàn thành"
            rules={[
              {
                validator: async (_rule, value) => {
                  const error = validateFutureDateTime(value);
                  if (error) {
                    throw new Error(error);
                  }
                },
              },
            ]}
          >
            <DatePicker showTime className="w-full" />
          </Form.Item>
          <Form.Item
            name="labelIds"
            label="Labels"
            rules={[
              {
                validator: async (_rule, value: string[] | undefined) => {
                  if ((value?.length ?? 0) > 20) {
                    throw new Error('Tối đa 20 labels mỗi task');
                  }
                },
              },
            ]}
          >
            <Select
              mode="multiple"
              allowClear
              optionLabelProp="rawLabel"
              options={labelOptions}
              tagRender={({ value, closable, onClose }) => {
                const label = labelOptionMap.get(String(value));
                return (
                  <Tag
                    closable={closable}
                    onClose={onClose}
                    className="my-[2px] rounded-full border px-2 py-0.5 text-xs font-semibold"
                    style={label ? buildTagPalette(label.color) : undefined}
                  >
                    {label?.name ?? value}
                  </Tag>
                );
              }}
            />
          </Form.Item>
        </div>
        <div>
          <p className="mb-2 text-sm font-medium text-slate-700">Tệp đính kèm</p>
          <Upload.Dragger
            multiple
            accept={[...TASK_ALLOWED_EXTENSIONS].join(',')}
            beforeUpload={() => false}
            listType="picture"
            fileList={attachmentQueue}
            onChange={({ fileList }) => handleAttachmentChange(fileList)}
            onRemove={(file) => {
              const nextList = attachmentQueue.filter((item) => item.uid !== file.uid);
              handleAttachmentChange(nextList);
            }}
            className="!rounded-xl !border-dashed !border-slate-300 !bg-slate-50/70"
          >
            <p className="ant-upload-drag-icon !mb-3">
              <InboxOutlined className="text-2xl text-primary" />
            </p>
            <p className="text-sm font-semibold text-slate-800">
              Kéo tệp vào đây hoặc bấm để chọn tệp
            </p>
            <p className="mt-1 text-xs text-slate-400">
              Hỗ trợ tài liệu, ảnh và file nén. Tối đa {TASK_ATTACHMENT_MAX_FILES} tệp.
            </p>
          </Upload.Dragger>
          {attachmentError ? (
            <p className="mt-2 text-xs text-red-500">{attachmentError}</p>
          ) : (
            <p className="mt-2 text-xs text-slate-400">
              Tối đa {TASK_ATTACHMENT_MAX_FILES} tệp, mỗi tệp không vượt quá 2.5MB.
            </p>
          )}
        </div>
      </Form>
    </Modal>
  );
}

interface TaskWorkspaceProps {
  groupId: string;
  group: GroupDetail;
}

export function TaskWorkspace({ groupId, group }: TaskWorkspaceProps) {
  const canDeleteTask = group.viewerRole === 'owner' || group.viewerRole === 'admin';
  const { view, filters, updateParams } = useTaskSearchState();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [isFilterPopoverOpen, setIsFilterPopoverOpen] = useState(false);
  const [draftFilters, setDraftFilters] = useState<TaskBoardFilters>(() =>
    cloneTaskFilters(filters),
  );
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));
  const labelsQuery = useGroupLabels(groupId);
  const statusesQuery = useGroupStatuses(groupId);
  const boardQuery = useTaskBoard(groupId, filters, view === 'board');
  const listQuery = useTaskList(groupId, filters, view === 'list');
  const createTaskMutation = useCreateTask(groupId);
  const updateTaskMutation = useUpdateTask(groupId);

  const boardData = boardQuery.data;
  const boardRows = useMemo(() => flattenBoardData(boardData), [boardData]);
  const listRows = useMemo(() => mapTaskListResponse(listQuery.data), [listQuery.data]);
  const labelOptions = useMemo(() => labelsQuery.data ?? [], [labelsQuery.data]);
  const statusColumns = useMemo(
    () => (statusesQuery.data ?? []).map((status) => ({ ...status, tasks: [] })),
    [statusesQuery.data],
  );
  const activeFilterCount = countActiveFilters(filters);
  const boardColumns = useMemo(() => boardData?.statuses ?? [], [boardData]);
  const statusOptions = useMemo(() => buildStatusOptions(statusColumns), [statusColumns]);
  const statusOptionMap = useMemo(
    () => new Map(statusOptions.map((option) => [option.value, option])),
    [statusOptions],
  );
  const activeFilterTags = useMemo(() => {
    const tags: Array<{ key: string; label: string }> = [];

    if (filters.q) {
      tags.push({ key: 'q', label: `Tên: ${filters.q}` });
    }

    if (filters.assigneeIds?.length) {
      const names = group.members
        .filter((member) => filters.assigneeIds?.includes(member.userId))
        .map((member) => member.name);

      if (names.length > 0) {
        tags.push({ key: 'assignees', label: `Người phụ trách: ${names.join(', ')}` });
      }
    }

    if (filters.statusIds?.length) {
      const names = statusOptions
        .filter((status) => filters.statusIds?.includes(status.value))
        .map((status) => status.label);

      if (names.length > 0) {
        tags.push({ key: 'statuses', label: `Trạng thái: ${names.join(', ')}` });
      }
    }

    if (filters.labelIds?.length) {
      const names = labelOptions
        .filter((label) => filters.labelIds?.includes(label._id))
        .map((label) => label.name);

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
  }, [filters, group.members, labelOptions, statusOptions]);
  const hasDraftChanges = useMemo(
    () => !areTaskFiltersEqual(draftFilters, filters),
    [draftFilters, filters],
  );
  const hasVisibleTasks = (view === 'list' ? listRows : boardRows).length > 0;

  const resetDraftFilters = () => {
    setDraftFilters({
      q: undefined,
      assigneeIds: [],
      statusIds: [],
      labelIds: [],
      dateFrom: undefined,
      dateTo: undefined,
    });
  };

  const applyDraftFilters = () => {
    updateParams({
      q: draftFilters.q?.trim() || null,
      assigneeIds: draftFilters.assigneeIds ?? [],
      statusIds: draftFilters.statusIds ?? [],
      labelIds: draftFilters.labelIds ?? [],
      dateFrom: draftFilters.dateFrom ?? null,
      dateTo: draftFilters.dateTo ?? null,
    });
    setIsFilterPopoverOpen(false);
  };

  const changeStatus = async (taskId: string, fromStatus: BoardColumn, toStatus: BoardColumn) => {
    const run = () =>
      updateTaskMutation.mutateAsync({
        taskId,
        payload: { statusId: toStatus._id },
      });

    if (fromStatus.isCompleted && !toStatus.isCompleted) {
      Modal.confirm({
        title: 'Chuyển công việc ra khỏi trạng thái hoàn thành?',
        content: 'Thao tác này sẽ mở lại công việc và cập nhật trạng thái mới.',
        okText: 'Xác nhận',
        cancelText: 'Hủy',
        onOk: run,
      });
      return;
    }

    await run();
  };

  if (
    statusesQuery.isLoading ||
    labelsQuery.isLoading ||
    (view === 'board' ? boardQuery.isLoading : listQuery.isLoading)
  ) {
    return <AppLoading minHeight={360} tip="Đang tải danh sách công việc..." />;
  }

  return (
    <section className="space-y-4">
      <section className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm shadow-slate-200/50">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1 shadow-sm shadow-slate-200/60">
              <Button
                type={view === 'board' ? 'primary' : 'text'}
                icon={<AppstoreOutlined />}
                onClick={() => updateParams({ view: null })}
                className="h-10 rounded-lg px-4 text-sm font-semibold"
              >
                Board
              </Button>
              <Button
                type={view === 'list' ? 'primary' : 'text'}
                icon={<UnorderedListOutlined />}
                onClick={() => updateParams({ view: 'list' })}
                className="h-10 rounded-lg px-4 text-sm font-semibold"
              >
                List
              </Button>
            </div>
            <div className="hidden h-8 w-px bg-slate-200 md:block" />
            <Popover
              open={isFilterPopoverOpen}
              onOpenChange={(open) => {
                setIsFilterPopoverOpen(open);
                if (open) {
                  setDraftFilters(cloneTaskFilters(filters));
                }
              }}
              trigger="click"
              placement="bottomLeft"
              content={
                <div className="w-[340px] space-y-3">
                  <div>
                    <p className="text-sm font-bold text-slate-950">Bộ lọc công việc</p>
                  </div>

                  <div className="space-y-1.5">
                    <ToolbarFieldLabel>Tìm kiếm</ToolbarFieldLabel>
                    <Input
                      allowClear
                      value={draftFilters.q}
                      onChange={(event) =>
                        setDraftFilters((current) => ({
                          ...current,
                          q: event.target.value || undefined,
                        }))
                      }
                      prefix={<SearchOutlined className="text-slate-400" />}
                      placeholder="Tìm theo tên công việc"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <ToolbarFieldLabel>Người phụ trách</ToolbarFieldLabel>
                    <Select
                      allowClear
                      mode="multiple"
                      value={draftFilters.assigneeIds}
                      onChange={(value) =>
                        setDraftFilters((current) => ({
                          ...current,
                          assigneeIds: value,
                        }))
                      }
                      placeholder="Chọn một hoặc nhiều thành viên"
                      className="w-full"
                      options={group.members.map((member) => ({
                        value: member.userId,
                        label: member.name,
                      }))}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <ToolbarFieldLabel>Ngày</ToolbarFieldLabel>
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
                          dateFrom: dates?.[0] ? dates[0].startOf('day').toISOString() : undefined,
                          dateTo: dates?.[1] ? dates[1].endOf('day').toISOString() : undefined,
                        }))
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <ToolbarFieldLabel>Trạng thái</ToolbarFieldLabel>
                    <div className="flex flex-wrap gap-2">
                      {statusColumns.map((status) => {
                        const isChecked = draftFilters.statusIds?.includes(status._id) ?? false;

                        return (
                          <Tag.CheckableTag
                            key={status._id}
                            checked={isChecked}
                            onChange={(checked) =>
                              setDraftFilters((current) => ({
                                ...current,
                                statusIds: toggleFilterId(current.statusIds, status._id, checked),
                              }))
                            }
                            className="m-0 rounded-full border-none px-3 py-1 text-xs font-semibold transition-all"
                            style={{
                              backgroundColor: isChecked
                                ? `${status.color}20`
                                : `${status.color}12`,
                              color: status.color,
                              boxShadow: `inset 0 0 0 1px ${isChecked ? `${status.color}55` : `${status.color}22`}`,
                            }}
                          >
                            {status.name}
                          </Tag.CheckableTag>
                        );
                      })}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <ToolbarFieldLabel>Labels</ToolbarFieldLabel>
                    <div className="flex flex-wrap gap-2">
                      {labelOptions.map((label) => {
                        const isChecked = draftFilters.labelIds?.includes(label._id) ?? false;

                        return (
                          <Tag.CheckableTag
                            key={label._id}
                            checked={isChecked}
                            onChange={(checked) =>
                              setDraftFilters((current) => ({
                                ...current,
                                labelIds: toggleFilterId(current.labelIds, label._id, checked),
                              }))
                            }
                            className="m-0 rounded-full border-none px-3 py-1 text-xs font-semibold transition-all"
                            style={{
                              backgroundColor: isChecked ? `${label.color}20` : `${label.color}12`,
                              color: label.color,
                              boxShadow: `inset 0 0 0 1px ${isChecked ? `${label.color}55` : `${label.color}22`}`,
                            }}
                          >
                            {label.name}
                          </Tag.CheckableTag>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-1">
                    <Button
                      size="small"
                      onClick={resetDraftFilters}
                      className="h-9 rounded-lg border-slate-200 px-4 text-sm font-semibold text-slate-600"
                    >
                      Reset
                    </Button>
                    <Button
                      type="primary"
                      size="small"
                      onClick={applyDraftFilters}
                      disabled={!hasDraftChanges}
                      className="h-9 rounded-lg px-4 text-sm font-semibold shadow-sm shadow-primary/20"
                    >
                      Apply
                    </Button>
                  </div>
                </div>
              }
            >
              <Button
                type={activeFilterCount > 0 ? 'default' : 'text'}
                icon={<FilterOutlined />}
                className={clsx(
                  'h-10 rounded-lg border-slate-200 px-3 text-sm font-semibold',
                  activeFilterCount > 0
                    ? 'bg-primary/5 text-primary shadow-sm shadow-primary/10'
                    : 'text-slate-600',
                )}
              >
                {activeFilterCount > 0 ? `Bộ lọc (${activeFilterCount})` : 'Bộ lọc'}
              </Button>
            </Popover>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* <Avatar.Group maxCount={3} maxStyle={{ color: '#0f172a', backgroundColor: '#e2e8f0' }}>
              {group.members.slice(0, 4).map((member) => (
                <Avatar
                  key={member.userId}
                  size={36}
                  src={member.avatar ?? undefined}
                  className="bg-primary/15 font-semibold text-primary"
                >
                  {member.name.slice(0, 2).toUpperCase()}
                </Avatar>
              ))}
            </Avatar.Group> */}

            {group.permissions.canCreateTasks && (
              <Button
                type="primary"
                size="middle"
                icon={<PlusOutlined />}
                onClick={() => setIsCreateModalOpen(true)}
                className="h-11 rounded-xl px-5 text-base font-semibold"
              >
                Tạo công việc
              </Button>
            )}
          </div>
        </div>

        {activeFilterTags.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
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
              onClick={() =>
                updateParams({
                  q: null,
                  assigneeIds: [],
                  statusIds: [],
                  labelIds: [],
                  dateFrom: null,
                  dateTo: null,
                })
              }
            >
              Xóa bộ lọc
            </Button>
          </div>
        )}
      </section>

      {activeFilterCount > 0 && !hasVisibleTasks && (
        <section className="rounded-2xl border border-dashed border-slate-200 bg-white px-5 py-5 text-sm text-slate-500">
          Không có công việc phù hợp với bộ lọc hiện tại. Hãy thử nới điều kiện hoặc xóa bớt bộ lọc.
        </section>
      )}

      {view === 'list' ? (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm shadow-slate-200/50">
          <Table<TaskListRowViewModel>
            rowKey="_id"
            dataSource={listRows}
            pagination={{ pageSize: 10, showSizeChanger: false }}
            locale={{
              emptyText:
                activeFilterCount > 0
                  ? 'Không có công việc phù hợp với bộ lọc hiện tại'
                  : 'Nhóm chưa có công việc nào',
            }}
            className="[&_.ant-table-cell]:align-middle [&_.ant-table-thead>tr>th]:bg-slate-50 [&_.ant-table-thead>tr>th]:text-xs [&_.ant-table-thead>tr>th]:font-bold [&_.ant-table-thead>tr>th]:uppercase [&_.ant-table-thead>tr>th]:tracking-[0.08em]"
            columns={[
              {
                title: 'Công việc',
                dataIndex: 'title',
                render: (_value, record) => (
                  <button
                    type="button"
                    className="text-left font-semibold text-slate-950 hover:text-primary"
                    onClick={() => setSelectedTaskId(record._id)}
                  >
                    {record.title}
                  </button>
                ),
              },
              {
                title: 'Trạng thái',
                dataIndex: 'statusId',
                render: (_value, record) => (
                  <Select
                    value={record.statusId}
                    className={clsx('min-w-[180px]', TASK_STATUS_SELECT_CLASSNAME)}
                    options={statusOptions}
                    popupClassName={TASK_STATUS_SELECT_POPUP_CLASSNAME}
                    labelRender={({ value, label }) =>
                      renderStatusSelectContent(
                        statusOptionMap.get(String(value)),
                        String(label ?? ''),
                      )
                    }
                    optionRender={(option) =>
                      renderStatusSelectOptionNode(option.data as TaskStatusSelectOption)
                    }
                    onChange={(nextStatusId) => {
                      const targetStatus = statusColumns.find(
                        (status) => status._id === nextStatusId,
                      );
                      const currentStatus = statusColumns.find(
                        (status) => status._id === record.statusId,
                      );
                      if (
                        !targetStatus ||
                        !currentStatus ||
                        targetStatus._id === currentStatus._id
                      ) {
                        return;
                      }
                      void changeStatus(record._id, currentStatus, targetStatus);
                    }}
                  />
                ),
              },
              {
                title: 'Assignee',
                dataIndex: 'assignee',
                render: (assignee: TaskListRowViewModel['assignee']) =>
                  assignee?.name || 'Chưa giao',
              },
              {
                title: 'Due date',
                dataIndex: 'deadline',
                render: (value: string | null, record) => formatDateTime(value || record.createdAt),
              },
              {
                title: 'Labels',
                dataIndex: 'labels',
                render: (labels: TaskListRowViewModel['labels']) => (
                  <div className="flex flex-wrap gap-1">
                    {labels.map((label) => (
                      <Tag
                        key={label._id}
                        className="m-0 rounded-full border-none px-2 py-1 text-[11px] font-semibold"
                        style={{ backgroundColor: `${label.color}1A`, color: label.color }}
                      >
                        {label.name}
                      </Tag>
                    ))}
                  </div>
                ),
              },
            ]}
          />
        </section>
      ) : (
        <DndContext
          sensors={sensors}
          onDragEnd={(event) => {
            const overId = event.over?.id?.toString();
            const sourceStatusId = event.active.data.current?.statusId as string | undefined;
            const taskId = event.active.id.toString();

            if (!overId?.startsWith('status:') || !sourceStatusId) {
              return;
            }

            const targetStatusId = overId.replace('status:', '');
            if (sourceStatusId === targetStatusId) {
              return;
            }

            const sourceStatus = statusColumns.find((status) => status._id === sourceStatusId);
            const targetStatus = statusColumns.find((status) => status._id === targetStatusId);
            if (!sourceStatus || !targetStatus) {
              return;
            }

            void changeStatus(taskId, sourceStatus, targetStatus);
          }}
        >
          {boardColumns.length > 0 ? (
            <section className="overflow-x-auto pb-2">
              <div className="flex min-w-max gap-5">
                {boardColumns.map((status) => (
                  <TaskBoardColumn
                    key={status._id}
                    status={status}
                    tasks={boardRows.filter(
                      (row: TaskListRowViewModel) => row.statusId === status._id,
                    )}
                    onOpenTask={setSelectedTaskId}
                  />
                ))}
              </div>
            </section>
          ) : (
            <section className="rounded-2xl border border-dashed border-slate-200 bg-white px-5 py-8 text-sm text-slate-500">
              Không thể tải dữ liệu board công việc lúc này.
            </section>
          )}
        </DndContext>
      )}

      <TaskCreateModal
        open={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onOpenTask={setSelectedTaskId}
        groupId={groupId}
        statuses={statusColumns}
        labels={labelOptions}
        members={group.members}
        loading={createTaskMutation.isPending}
        onSubmit={(payload) => createTaskMutation.mutateAsync(payload)}
      />

      <TaskDetailModal
        key={selectedTaskId ?? 'task-detail-empty'}
        groupId={groupId}
        canManageTaskContent={group.permissions.canManageTasks}
        canDeleteTask={canDeleteTask}
        taskId={selectedTaskId}
        open={Boolean(selectedTaskId)}
        onClose={() => setSelectedTaskId(null)}
        statuses={statusColumns}
        labels={labelOptions}
        members={group.members}
      />
    </section>
  );
}

export default function GroupTasksPage() {
  const { groupId, group } = useGroupDetailLayoutContext();

  return <TaskWorkspace groupId={groupId} group={group} />;
}
