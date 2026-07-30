import { useEffect, useMemo, useState } from 'react';
import {
  Avatar,
  Button,
  DatePicker,
  Form,
  Image,
  Input,
  Modal,
  Select,
  Tag,
  Upload,
} from 'antd';
import {
  AppstoreOutlined,
  DeleteOutlined,
  DownloadOutlined,
  EditOutlined,
  FileOutlined,
  InboxOutlined,
  MessageOutlined,
  PaperClipOutlined,
  SendOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import type { Dayjs } from 'dayjs';
import clsx from 'clsx';
import type { UploadFile } from 'antd/es/upload/interface';
import { AppLoading } from '@/components';
import { useCurrentUser } from '@/features/auth/hooks/useCurrentUser';
import {
  useCreateTaskComment,
  useDeleteTask,
  useDeleteTaskAttachment,
  useDeleteTaskComment,
  useTaskComments,
  useTaskDetail,
  useUpdateTask,
  useUpdateTaskComment,
  useUploadTaskAttachments,
} from '@/features/tasks';
import type { BoardColumn, GroupMember, TaskComment, TaskDetail, TaskLabel } from '@/types';
import {
  downloadTaskAttachmentApi,
  getTaskAttachmentBlobApi,
} from '@/features/tasks/api/taskApi';
import { TaskRichTextEditor } from '@/features/tasks/components/TaskRichTextEditor';
import {
  extractPlainTextFromHtml,
  mapUploadFilesToFiles,
  normalizeRichTextHtml,
  TASK_ALLOWED_EXTENSIONS,
  TASK_ATTACHMENT_MAX_FILES,
  TASK_DESCRIPTION_MAX_TEXT_LENGTH,
  validateAttachmentFile,
  validateCommentContent,
  validateFutureDateTime,
  validateTaskDescriptionHtml,
} from '@/features/tasks/utils';
import { formatDateTime, formatRelative } from '@/lib/utils/formatDate';
import { normalizeApiError } from '@/services/http';
import { showApiError } from '@/services/ui';

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

interface TaskDetailEditorFormValues {
  title: string;
  statusId: string;
  assigneeId?: string | null;
  deadline?: Dayjs | null;
  labelIds?: string[];
}

export interface TaskDetailModalProps {
  groupId: string;
  canManageTaskContent: boolean;
  canDeleteTask: boolean;
  taskId: string | null;
  open: boolean;
  onClose: () => void;
  statuses: BoardColumn[];
  labels: TaskLabel[];
  members: GroupMember[];
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

function isSameMoment(left: string | null, right: string | null) {
  if (!left && !right) {
    return true;
  }

  if (!left || !right) {
    return false;
  }

  return dayjs(left).isSame(dayjs(right));
}

function formatAttachmentSize(size: number) {
  if (size < 1024) {
    return `${size} B`;
  }
  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function isImageAttachment(attachment: TaskDetail['attachments'][number]) {
  if (attachment.mimeType.startsWith('image/')) {
    return true;
  }

  const extension = attachment.originalName.split('.').pop()?.toLowerCase();
  return ['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(extension ?? '');
}

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
  return <div className="flex w-full items-center gap-2.5">{renderStatusSelectContent(option, fallback)}</div>;
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

function TaskAttachmentCard({
  groupId,
  taskId,
  attachment,
}: {
  groupId: string;
  taskId: string;
  attachment: TaskDetail['attachments'][number];
}) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const imageAttachment = isImageAttachment(attachment);

  useEffect(() => {
    if (!imageAttachment) {
      return;
    }

    let active = true;
    let objectUrl: string | null = null;

    void getTaskAttachmentBlobApi(groupId, taskId, attachment._id)
      .then((blob) => {
        objectUrl = window.URL.createObjectURL(blob);
        if (active) {
          setPreviewUrl(objectUrl);
          return;
        }

        window.URL.revokeObjectURL(objectUrl);
      })
      .catch(() => {
        if (active) {
          setPreviewUrl(null);
        }
      });

    return () => {
      active = false;
      if (objectUrl) {
        window.URL.revokeObjectURL(objectUrl);
      }
    };
  }, [attachment._id, groupId, imageAttachment, taskId]);

  if (imageAttachment && previewUrl) {
    return (
      <div className="w-[156px] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <Image
          src={previewUrl}
          alt={attachment.originalName}
          className="!h-24 !w-full object-cover"
          rootClassName="!block"
          preview={{ mask: <span className="text-xs font-semibold">Xem ảnh</span> }}
        />
        <div className="flex items-center justify-between gap-3 px-3 py-2.5">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-900 !mb-1">
              {attachment.originalName}
            </p>
            <p className="mt-0.5 text-xs text-slate-500">{formatAttachmentSize(attachment.size)}</p>
          </div>
          <Button
            size="small"
            type="text"
            icon={<DownloadOutlined />}
            onClick={async () => {
              try {
                await downloadTaskAttachmentApi(
                  groupId,
                  taskId,
                  attachment._id,
                  attachment.originalName,
                );
              } catch (error) {
                showApiError(normalizeApiError(error));
              }
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      className="group flex h-[126px] w-[156px] flex-col justify-between rounded-xl border border-slate-200 bg-white p-3 text-left shadow-sm transition hover:border-primary/30 hover:shadow-md"
      onClick={async () => {
        try {
          await downloadTaskAttachmentApi(groupId, taskId, attachment._id, attachment.originalName);
        } catch (error) {
          showApiError(normalizeApiError(error));
        }
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <FileOutlined className="mt-0.5 text-lg text-slate-400 transition group-hover:text-primary" />
        <DownloadOutlined className="text-slate-300 transition group-hover:text-primary" />
      </div>
      <div>
        <p className="truncate text-sm font-semibold text-slate-900 !mb-1">
          {attachment.originalName}
        </p>
        <p className="mt-1 text-xs text-slate-500">{formatAttachmentSize(attachment.size)}</p>
      </div>
    </button>
  );
}

function TaskCommentsSection({
  groupId,
  taskId,
  task,
  comments,
  commentsLoading,
  canManageTaskContent,
}: {
  groupId: string;
  taskId: string;
  task: TaskDetail;
  comments: TaskComment[];
  commentsLoading: boolean;
  canManageTaskContent: boolean;
}) {
  const createCommentMutation = useCreateTaskComment(groupId, taskId);
  const updateCommentMutation = useUpdateTaskComment(groupId, taskId);
  const deleteCommentMutation = useDeleteTaskComment(groupId, taskId);
  const { user } = useCurrentUser();
  const [commentValue, setCommentValue] = useState('');
  const [commentError, setCommentError] = useState<string | null>(null);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingCommentValue, setEditingCommentValue] = useState('');
  const [editingCommentError, setEditingCommentError] = useState<string | null>(null);

  return (
    <section className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
      <div className="mb-3 flex items-center gap-2">
        <MessageOutlined className="text-slate-500" />
        <h3 className="!mb-0 text-sm font-semibold text-slate-900">
          Bình luận ({task.commentCount})
        </h3>
      </div>

      <div className="rounded-lg bg-white p-3">
        <Input.TextArea
          rows={3}
          value={commentValue}
          onChange={(event) => {
            const nextValue = event.target.value;
            setCommentValue(nextValue);
            setCommentError(validateCommentContent(nextValue));
          }}
          placeholder="Viết bình luận cho công việc này"
        />
        <div className="mt-2 flex items-center justify-between gap-3">
          <p className={clsx('text-xs', commentError ? 'text-red-500' : 'text-slate-400')}>
            {commentError ?? `${commentValue.trim().length}/2000 ký tự`}
          </p>
          <Button
            type="primary"
            size="small"
            icon={<SendOutlined />}
            loading={createCommentMutation.isPending}
            onClick={async () => {
              const error = validateCommentContent(commentValue);
              setCommentError(error);
              if (error) {
                return;
              }

              await createCommentMutation.mutateAsync({ content: commentValue.trim() });
              setCommentValue('');
              setCommentError(null);
            }}
          >
            Gửi bình luận
          </Button>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {commentsLoading ? (
          <AppLoading minHeight={160} tip="Đang tải bình luận..." />
        ) : comments.length > 0 ? (
          comments.map((comment) => {
            const canEdit = user?._id === comment.author._id;
            const canDelete = canEdit || canManageTaskContent;
            const isEditing = editingCommentId === comment._id;

            return (
              <div key={comment._id} className="rounded-lg bg-white p-3">
                <div className="flex items-start gap-3">
                  <Avatar size={36} src={comment.author.avatar ?? undefined}>
                    {comment.author.name.slice(0, 2).toUpperCase()}
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <p className="!mb-0 text-sm font-semibold text-slate-900">
                          {comment.author.name}
                        </p>
                        <span className="text-xs text-slate-400">
                          {formatDateTime(comment.createdAt)}
                        </span>
                        <span className="text-xs text-slate-400">
                          {formatRelative(comment.createdAt)}
                        </span>
                        {comment.isEdited && (
                          <span className="text-xs text-slate-400">(đã chỉnh sửa)</span>
                        )}
                      </div>

                      {!isEditing && (canEdit || canDelete) && (
                        <div className="flex items-center gap-1">
                          {canEdit && (
                            <Button
                              size="small"
                              type="text"
                              icon={<EditOutlined />}
                              className="px-2 text-slate-500 hover:text-primary"
                              onClick={() => {
                                setEditingCommentId(comment._id);
                                setEditingCommentValue(comment.content);
                                setEditingCommentError(null);
                              }}
                            >
                              Sửa
                            </Button>
                          )}
                          {canDelete && (
                            <Button
                              size="small"
                              danger
                              type="text"
                              icon={<DeleteOutlined />}
                              className="px-2"
                              loading={deleteCommentMutation.isPending}
                              onClick={() => void deleteCommentMutation.mutateAsync(comment._id)}
                            >
                              Xóa
                            </Button>
                          )}
                        </div>
                      )}
                    </div>

                    {isEditing ? (
                      <div className="mt-3 space-y-2">
                        <Input.TextArea
                          rows={3}
                          value={editingCommentValue}
                          onChange={(event) => {
                            const nextValue = event.target.value;
                            setEditingCommentValue(nextValue);
                            setEditingCommentError(validateCommentContent(nextValue));
                          }}
                        />
                        <div className="flex items-center justify-between gap-3">
                          <p
                            className={clsx(
                              'text-xs',
                              editingCommentError ? 'text-red-500' : 'text-slate-400',
                            )}
                          >
                            {editingCommentError ??
                              `${editingCommentValue.trim().length}/2000 ký tự`}
                          </p>
                          <div className="flex items-center gap-2">
                            <Button
                              size="small"
                              onClick={() => {
                                setEditingCommentId(null);
                                setEditingCommentValue('');
                                setEditingCommentError(null);
                              }}
                            >
                              Hủy
                            </Button>
                            <Button
                              type="primary"
                              size="small"
                              loading={updateCommentMutation.isPending}
                              onClick={async () => {
                                const error = validateCommentContent(editingCommentValue);
                                setEditingCommentError(error);
                                if (error) {
                                  return;
                                }

                                await updateCommentMutation.mutateAsync({
                                  commentId: comment._id,
                                  payload: { content: editingCommentValue.trim() },
                                });
                                setEditingCommentId(null);
                                setEditingCommentValue('');
                                setEditingCommentError(null);
                              }}
                            >
                              Lưu
                            </Button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                        {comment.content}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <p className="text-sm text-slate-500">Chưa có bình luận nào.</p>
        )}
      </div>
    </section>
  );
}

function TaskDetailViewer({
  groupId,
  taskId,
  task,
  comments,
  commentsLoading,
  canManageTaskContent,
  canDeleteTask,
  onClose,
  onEdit,
  statuses,
  members,
}: {
  groupId: string;
  taskId: string;
  task: TaskDetail;
  comments: TaskComment[];
  commentsLoading: boolean;
  canManageTaskContent: boolean;
  canDeleteTask: boolean;
  onClose: () => void;
  onEdit: () => void;
  statuses: BoardColumn[];
  members: GroupMember[];
}) {
  const updateTaskMutation = useUpdateTask(groupId);
  const deleteTaskMutation = useDeleteTask(groupId, taskId);
  const [selectedStatusId, setSelectedStatusId] = useState(task.status._id);
  const [selectedAssigneeId, setSelectedAssigneeId] = useState<string | null>(
    task.assignee?._id ?? null,
  );
  const [selectedDeadline, setSelectedDeadline] = useState(
    task.deadline ? dayjs(task.deadline) : null,
  );
  const [deadlineError, setDeadlineError] = useState<string | null>(null);
  const statusOptions = useMemo(() => buildStatusOptions(statuses), [statuses]);
  const statusOptionMap = useMemo(
    () => new Map(statusOptions.map((option) => [option.value, option])),
    [statusOptions],
  );

  const handleStatusChange = async (nextStatusId: string) => {
    if (nextStatusId === selectedStatusId) {
      return;
    }

    const previousStatus = statuses.find((status) => status._id === selectedStatusId);
    const nextStatus = statuses.find((status) => status._id === nextStatusId);
    if (!nextStatus) {
      return;
    }

    const run = async () => {
      const previousValue = selectedStatusId;
      setSelectedStatusId(nextStatusId);
      try {
        await updateTaskMutation.mutateAsync({ taskId, payload: { statusId: nextStatusId } });
      } catch {
        setSelectedStatusId(previousValue);
      }
    };

    if (previousStatus?.isCompleted && !nextStatus.isCompleted) {
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

  const handleAssigneeChange = async (nextAssigneeId: string | null) => {
    const previousValue = selectedAssigneeId;
    setSelectedAssigneeId(nextAssigneeId);
    try {
      await updateTaskMutation.mutateAsync({
        taskId,
        payload: { assigneeId: nextAssigneeId ?? null },
      });
    } catch {
      setSelectedAssigneeId(previousValue);
    }
  };

  const handleDeadlineChange = async (nextValue: Dayjs | null) => {
    const nextError = validateFutureDateTime(nextValue);
    if (nextError) {
      setDeadlineError(nextError);
      return;
    }

    const previousValue = selectedDeadline;
    setSelectedDeadline(nextValue);
    setDeadlineError(null);

    try {
      await updateTaskMutation.mutateAsync({
        taskId,
        payload: { deadline: nextValue ? nextValue.toISOString() : null },
      });
    } catch {
      setSelectedDeadline(previousValue);
    }
  };

  return (
    <div className="overflow-hidden">
      <div className="flex h-[78vh] max-h-[78vh] min-h-0 flex-col lg:flex-row">
        <div className="min-h-0 min-w-0 flex-1 border-b border-slate-200 lg:border-b-0 lg:border-r">
          <div className="h-full overflow-y-auto px-2 py-0 lg:px-2 lg:py-0">
            <div className="mx-auto max-w-3xl space-y-5">
              <div className="sticky top-0 z-20 -mx-4 border-b border-slate-100 bg-white/95 px-4 pb-3 pt-1 backdrop-blur lg:-mx-6 lg:px-6">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div className="flex items-start gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <AppstoreOutlined className="text-xl" />
                    </div>
                    <div className="space-y-1">
                      <p className="!mb-0 text-[9px] font-bold uppercase tracking-[0.16em] text-slate-400">
                        Công việc
                      </p>
                      <h2 className="!mb-0 text-[20px] font-black leading-tight tracking-tight text-slate-950">
                        {task.title}
                      </h2>
                      <p className="text-[11px] text-slate-500">
                        Tạo {formatRelative(task.createdAt)} bởi {task.creator.name}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2">
                    {canDeleteTask && (
                      <Button
                        danger
                        size="small"
                        icon={<DeleteOutlined />}
                        className="h-9 rounded-lg px-3.5 font-semibold"
                        loading={deleteTaskMutation.isPending}
                        onClick={() => {
                          Modal.confirm({
                            title: `Xóa công việc "${task.title}"?`,
                            content:
                              'Bình luận, nhãn và tệp đính kèm của công việc này sẽ bị xóa vĩnh viễn.',
                            okText: 'Xóa công việc',
                            cancelText: 'Hủy',
                            okButtonProps: { danger: true, loading: deleteTaskMutation.isPending },
                            onOk: async () => {
                              await deleteTaskMutation.mutateAsync();
                              onClose();
                            },
                          });
                        }}
                      >
                        Xóa
                      </Button>
                    )}
                    {canManageTaskContent && (
                      <Button
                        type="primary"
                        size="small"
                        icon={<EditOutlined />}
                        className="h-9 rounded-lg px-3.5 font-semibold"
                        onClick={onEdit}
                      >
                        Sửa
                      </Button>
                    )}
                    <Button
                      size="small"
                      className="h-9 rounded-lg px-3.5 font-semibold"
                      onClick={onClose}
                    >
                      Đóng
                    </Button>
                  </div>
                </div>
              </div>

              <section className="space-y-2.5">
                <div className="flex items-center gap-2">
                  <FileOutlined className="text-slate-400" />
                  <h3 className="!mb-0 text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">
                    Mô tả
                  </h3>
                </div>
                {task.description ? (
                  <div
                    className="prose prose-sm max-w-none text-slate-700"
                    dangerouslySetInnerHTML={{ __html: task.description }}
                  />
                ) : (
                  <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">
                    Chưa có mô tả cho công việc này.
                  </div>
                )}
              </section>

              <section className="space-y-2.5">
                <div className="flex items-center gap-2">
                  <PaperClipOutlined className="text-slate-400" />
                  <h3 className="!mb-0 text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">
                    Tệp đính kèm
                  </h3>
                </div>
                {task.attachments.length > 0 ? (
                  <div className="flex flex-wrap gap-3">
                    {task.attachments.map((attachment) => (
                      <TaskAttachmentCard
                        key={attachment._id}
                        groupId={groupId}
                        taskId={taskId}
                        attachment={attachment}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">
                    Chưa có tệp đính kèm nào.
                  </div>
                )}
              </section>

              <TaskCommentsSection
                groupId={groupId}
                taskId={taskId}
                task={task}
                comments={comments}
                commentsLoading={commentsLoading}
                canManageTaskContent={canManageTaskContent}
              />
            </div>
          </div>
        </div>

        <aside className="min-h-0 w-full shrink-0 overflow-y-auto bg-slate-50/80 px-4 py-4 lg:w-[320px] lg:px-5 lg:py-5">
          <div className="space-y-4">
            <div>
              <p className="mb-2 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                Status
              </p>
              <Select
                value={selectedStatusId}
                options={statusOptions}
                disabled={updateTaskMutation.isPending}
                onChange={(value) => void handleStatusChange(value)}
                className={clsx('w-full', TASK_STATUS_SELECT_CLASSNAME)}
                popupClassName={TASK_STATUS_SELECT_POPUP_CLASSNAME}
                labelRender={({ value, label }) =>
                  renderStatusSelectContent(statusOptionMap.get(String(value)), String(label ?? ''))
                }
                optionRender={(option) =>
                  renderStatusSelectOptionNode(option.data as TaskStatusSelectOption)
                }
              />
            </div>

            <div>
              <p className="mb-2 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                Assignee
              </p>
              <Select
                allowClear
                value={selectedAssigneeId}
                placeholder="Chọn người phụ trách"
                disabled={updateTaskMutation.isPending}
                onChange={(value) => void handleAssigneeChange(value ?? null)}
                className="w-full"
                options={members.map((member) => ({
                  value: member.userId,
                  label: member.name,
                }))}
              />
            </div>

            <div>
              <p className="mb-2 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                Due date
              </p>
              <DatePicker
                showTime
                allowClear
                value={selectedDeadline}
                disabled={updateTaskMutation.isPending}
                onChange={(value) => void handleDeadlineChange(value)}
                className="w-full"
              />
              {deadlineError && <p className="mt-2 text-xs text-red-500">{deadlineError}</p>}
            </div>

            <div>
              <p className="mb-2 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                Labels
              </p>
              {task.labels.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {task.labels.map((label) => (
                    <Tag
                      key={label._id}
                      className="m-0 rounded-md border px-2 py-1 text-[11px] font-bold"
                      style={buildTagPalette(label.color)}
                    >
                      {label.name}
                    </Tag>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-500">Chưa có label nào.</p>
              )}
            </div>

            <div className="border-t border-slate-200 pt-5">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-slate-500">Cập nhật</span>
                <span className="font-semibold text-slate-900">
                  {formatRelative(task.updatedAt)}
                </span>
              </div>
              <div className="mt-2 flex items-center justify-between text-sm">
                <span className="font-medium text-slate-500">Ngày tạo</span>
                <span className="font-semibold text-slate-900">
                  {formatDateTime(task.createdAt)}
                </span>
              </div>
              <div className="mt-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-slate-500">Người tạo</span>
                  <span className="truncate text-right font-semibold text-slate-900">
                    {task.creator.name}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function TaskDetailEditor({
  groupId,
  taskId,
  task,
  canManageTaskContent,
  onCancelEdit,
  onSaved,
  statuses,
  labels,
  members,
}: {
  groupId: string;
  taskId: string;
  task: TaskDetail;
  canManageTaskContent: boolean;
  onCancelEdit: () => void;
  onSaved: () => void;
  statuses: BoardColumn[];
  labels: TaskLabel[];
  members: GroupMember[];
}) {
  const updateTaskMutation = useUpdateTask(groupId);
  const uploadAttachmentsMutation = useUploadTaskAttachments(groupId, taskId);
  const deleteAttachmentMutation = useDeleteTaskAttachment(groupId, taskId);
  const { user } = useCurrentUser();
  const [form] = Form.useForm<TaskDetailEditorFormValues>();
  const [descriptionHtml, setDescriptionHtml] = useState<string | null>(task.description ?? null);
  const [descriptionError, setDescriptionError] = useState<string | null>(null);
  const [attachmentQueue, setAttachmentQueue] = useState<UploadFile[]>([]);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const statusOptions = useMemo(() => buildStatusOptions(statuses), [statuses]);
  const statusOptionMap = useMemo(
    () => new Map(statusOptions.map((option) => [option.value, option])),
    [statusOptions],
  );
  const labelOptions = useMemo(() => buildLabelOptions(labels), [labels]);
  const labelOptionMap = useMemo(() => new Map(labels.map((label) => [label._id, label])), [labels]);

  const handleAttachmentQueueChange = async (nextList: UploadFile[]) => {
    const { nextFileList, error } = buildUploadQueue(nextList, task.attachments.length);
    setAttachmentQueue(nextFileList);
    setAttachmentError(error);

    if (error || nextFileList.length === 0 || uploadAttachmentsMutation.isPending) {
      return;
    }

    const files = mapUploadFilesToFiles(nextFileList);
    if (files.length === 0) {
      return;
    }

    await uploadAttachmentsMutation.mutateAsync(files);
    setAttachmentQueue([]);
    setAttachmentError(null);
  };

  const submitTaskChanges = async () => {
    const values = await form.validateFields();
    const nextDescriptionError = validateTaskDescriptionHtml(descriptionHtml);
    if (nextDescriptionError) {
      setDescriptionError(nextDescriptionError);
      return;
    }

    const payload: {
      title?: string;
      description?: string | null;
      statusId?: string;
      assigneeId?: string | null;
      deadline?: string | null;
      labelIds?: string[];
    } = {};
    const nextTitle = normalizeTaskTitleValue(values.title);
    if (nextTitle !== task.title) {
      payload.title = nextTitle;
    }

    const nextDescription = normalizeRichTextHtml(descriptionHtml);
    if ((task.description ?? null) !== nextDescription) {
      payload.description = nextDescription;
    }

    if (values.statusId && values.statusId !== task.status._id) {
      payload.statusId = values.statusId;
    }

    const nextAssigneeId = values.assigneeId ?? null;
    const currentAssigneeId = task.assignee?._id ?? null;
    if (nextAssigneeId !== currentAssigneeId) {
      payload.assigneeId = nextAssigneeId;
    }

    const nextDeadline = values.deadline ? dayjs(values.deadline).toISOString() : null;
    if (!isSameMoment(task.deadline, nextDeadline)) {
      payload.deadline = nextDeadline;
    }

    const currentLabelIds = [...task.labels.map((label) => label._id)].sort();
    const nextLabelIds = [...new Set(values.labelIds ?? [])].sort();
    if (currentLabelIds.join(',') !== nextLabelIds.join(',')) {
      payload.labelIds = nextLabelIds;
    }

    if (Object.keys(payload).length === 0) {
      onSaved();
      return;
    }

    const nextStatus = payload.statusId
      ? statuses.find((status) => status._id === payload.statusId)
      : undefined;

    if (task.status && nextStatus && task.status._id !== nextStatus._id) {
      const previousStatus = statuses.find((status) => status._id === task.status._id);
      if (previousStatus?.isCompleted && !nextStatus.isCompleted) {
        const confirmed = await new Promise<boolean>((resolve) => {
          Modal.confirm({
            title: 'Chuyển công việc ra khỏi trạng thái hoàn thành?',
            content: 'Thao tác này sẽ mở lại công việc và cập nhật trạng thái mới.',
            okText: 'Xác nhận',
            cancelText: 'Hủy',
            onOk: async () => resolve(true),
            onCancel: () => resolve(false),
          });
        });

        if (!confirmed) {
          return;
        }
      }
    }

    await updateTaskMutation.mutateAsync({ taskId, payload });
    onSaved();
  };

  return (
    <div className="space-y-3 px-0 py-0">
      <Form
        form={form}
        layout="vertical"
        className="[&_.ant-form-item]:!mb-3 [&_.ant-form-item-label]:!pb-1"
        initialValues={{
          title: task.title,
          statusId: task.status._id,
          assigneeId: task.assignee?._id ?? null,
          deadline: task.deadline ? dayjs(task.deadline) : null,
          labelIds: task.labels.map((label) => label._id),
        }}
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
          <Input />
        </Form.Item>

        <div className="mb-5">
          <p className="mb-2 text-sm font-medium text-slate-700">Mô tả</p>
          <TaskRichTextEditor
            value={descriptionHtml}
            onChange={(value) => {
              setDescriptionHtml(value);
              setDescriptionError(validateTaskDescriptionHtml(value));
            }}
            error={descriptionError}
            placeholder="Nhập mô tả công việc"
          />
          <p className="mt-2 text-xs text-slate-400">
            {extractPlainTextFromHtml(descriptionHtml).length}/{TASK_DESCRIPTION_MAX_TEXT_LENGTH} ký
            tự
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <Form.Item name="statusId" label="Trạng thái">
            <Select
              options={statusOptions}
              className={TASK_STATUS_SELECT_CLASSNAME}
              popupClassName={TASK_STATUS_SELECT_POPUP_CLASSNAME}
              labelRender={({ value, label }) =>
                renderStatusSelectContent(statusOptionMap.get(String(value)), String(label ?? ''))
              }
              optionRender={(option) =>
                renderStatusSelectOptionNode(option.data as TaskStatusSelectOption)
              }
            />
          </Form.Item>
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

        <div className="grid gap-3 md:grid-cols-2">
          <Form.Item
            name="deadline"
            label="Hạn hoàn thành"
            rules={[
              {
                validator: async (_rule, value) => {
                  if (!value) {
                    return;
                  }

                  const error = validateFutureDateTime(value);
                  if (!error) {
                    return;
                  }

                  const currentDeadline = task.deadline ? dayjs(task.deadline) : null;
                  if (currentDeadline && value.isSame(currentDeadline)) {
                    return;
                  }

                  throw new Error(error);
                },
              },
            ]}
          >
            <DatePicker showTime className="w-full" allowClear />
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
      </Form>

      <section className="rounded-xl border border-slate-200 bg-slate-50/50 p-3.5">
        <div className="mb-3 flex flex-col justify-between gap-2.5">
          <div className="flex items-center gap-2">
            <PaperClipOutlined className="text-slate-500" />
            <h3 className="!mb-0 text-sm font-semibold text-slate-900">
              Tệp đính kèm ({task.attachments.length})
            </h3>
          </div>
          <Upload.Dragger
            multiple
            accept={[...TASK_ALLOWED_EXTENSIONS].join(',')}
            beforeUpload={() => false}
            listType="picture"
            fileList={attachmentQueue}
            disabled={uploadAttachmentsMutation.isPending}
            onChange={({ fileList }) => {
              void handleAttachmentQueueChange(fileList);
            }}
            onRemove={(file) => {
              const nextList = attachmentQueue.filter((item) => item.uid !== file.uid);
              setAttachmentQueue(nextList);
              setAttachmentError(null);
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
              Tệp sẽ được tải lên tự động ngay sau khi chọn.
            </p>
          </Upload.Dragger>
        </div>

        {attachmentError && <p className="mb-3 text-xs text-red-500">{attachmentError}</p>}
        {uploadAttachmentsMutation.isPending && (
          <p className="mb-3 text-xs text-slate-500">Đang tải tệp lên...</p>
        )}

        <div className="space-y-2">
          {task.attachments.length ? (
            task.attachments.map((attachment) => {
              const canDelete = user?._id === attachment.uploadedBy._id || canManageTaskContent;

              return (
                <div
                  key={attachment._id}
                  className="flex items-center justify-between gap-3 rounded-lg bg-white px-3 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <FileOutlined className="text-slate-400" />
                      <p className="truncate text-sm font-medium text-slate-900">
                        {attachment.originalName}
                      </p>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      {formatAttachmentSize(attachment.size)} · Tải lên bởi{' '}
                      {attachment.uploadedBy.name || 'Người dùng'} ·{' '}
                      {formatDateTime(attachment.createdAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="small"
                      icon={<DownloadOutlined />}
                      onClick={async () => {
                        try {
                          await downloadTaskAttachmentApi(
                            groupId,
                            taskId,
                            attachment._id,
                            attachment.originalName,
                          );
                        } catch (error) {
                          showApiError(normalizeApiError(error));
                        }
                      }}
                    >
                      Tải xuống
                    </Button>
                    {canDelete && (
                      <Button
                        size="small"
                        danger
                        icon={<DeleteOutlined />}
                        loading={deleteAttachmentMutation.isPending}
                        onClick={() => void deleteAttachmentMutation.mutateAsync(attachment._id)}
                      >
                        Xóa
                      </Button>
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            <p className="text-sm text-slate-500">Chưa có tệp đính kèm nào.</p>
          )}
        </div>
      </section>

      <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
        <Button onClick={onCancelEdit}>Hủy</Button>
        <Button type="primary" loading={updateTaskMutation.isPending} onClick={submitTaskChanges}>
          Lưu thay đổi
        </Button>
      </div>
    </div>
  );
}

export function TaskDetailModal({
  groupId,
  canManageTaskContent,
  canDeleteTask,
  taskId,
  open,
  onClose,
  statuses,
  labels,
  members,
}: TaskDetailModalProps) {
  const taskDetailQuery = useTaskDetail(groupId, taskId, open);
  const commentsQuery = useTaskComments(groupId, taskId, open);
  const [isEditing, setIsEditing] = useState(false);

  return (
    <Modal
      open={open}
      onCancel={onClose}
      title={isEditing ? 'Sửa công việc' : null}
      width={TASK_MODAL_WIDTH}
      style={{ top: TASK_MODAL_TOP }}
      footer={null}
      destroyOnHidden
      closable={isEditing}
    >
      {taskDetailQuery.isLoading ? (
        <AppLoading minHeight={220} tip="Đang tải chi tiết công việc..." />
      ) : taskDetailQuery.data && taskId ? (
        isEditing ? (
          <TaskDetailEditor
            key={`${taskDetailQuery.data._id}:${taskDetailQuery.data.updatedAt}:edit`}
            groupId={groupId}
            taskId={taskId}
            task={taskDetailQuery.data}
            canManageTaskContent={canManageTaskContent}
            onCancelEdit={() => setIsEditing(false)}
            onSaved={() => setIsEditing(false)}
            statuses={statuses}
            labels={labels}
            members={members}
          />
        ) : (
          <TaskDetailViewer
            key={`${taskDetailQuery.data._id}:${taskDetailQuery.data.updatedAt}:view`}
            groupId={groupId}
            taskId={taskId}
            task={taskDetailQuery.data}
            comments={commentsQuery.data ?? []}
            commentsLoading={commentsQuery.isLoading}
            canManageTaskContent={canManageTaskContent}
            canDeleteTask={canDeleteTask}
            onClose={onClose}
            onEdit={() => setIsEditing(true)}
            statuses={statuses}
            members={members}
          />
        )
      ) : (
        <div className="py-8 text-center text-sm text-slate-500">
          Không thể tải chi tiết công việc lúc này.
        </div>
      )}
    </Modal>
  );
}

export default TaskDetailModal;
