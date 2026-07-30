import type {
  BoardData,
  BoardColumn,
  GroupDetail,
  MyTaskLabelFilterOption,
  MyTaskStatusFilterOption,
  MyTaskItem,
  TaskItem,
  TaskListResponse,
  TaskAttachment,
  TaskComment,
  TaskDetail,
  TaskListItem,
} from '@/types';

export type TaskViewMode = 'board' | 'list';

export interface TaskBoardFilters {
  q?: string;
  assigneeIds?: string[];
  statusIds?: string[];
  labelIds?: string[];
  dateFrom?: string;
  dateTo?: string;
}

export interface MyTaskFilters {
  q?: string;
  groupIds?: string[];
  statusIds?: string[];
  labelIds?: string[];
  dateFrom?: string;
  dateTo?: string;
}

export interface MyTaskListRowViewModel extends MyTaskItem {
  key: string;
}

export type MyTaskScopedStatusOption = MyTaskStatusFilterOption;
export type MyTaskScopedLabelOption = MyTaskLabelFilterOption;

export interface CreateTaskPayload {
  title: string;
  description?: string | null;
  statusId?: string;
  assigneeId?: string;
  deadline?: string;
  labelIds?: string[];
}

export interface UpdateTaskPayload {
  title?: string;
  description?: string | null;
  statusId?: string;
  assigneeId?: string | null;
  deadline?: string | null;
  labelIds?: string[];
}

export interface CreateTaskCommentPayload {
  content: string;
}

export interface UpdateTaskCommentPayload {
  content: string;
}

export interface UploadTaskAttachmentsPayload {
  files: File[];
}

export interface TaskRichTextEditorValue {
  html: string | null;
  plainTextLength: number;
}

export interface TaskListRowViewModel extends TaskListItem {
  key: string;
}

export interface TaskFormOptions {
  group: GroupDetail;
}

export type TaskAttachments = TaskAttachment[];
export type TaskComments = TaskComment[];

export function flattenBoardData(boardData: BoardData | undefined): TaskListRowViewModel[] {
  if (!boardData) {
    return [];
  }

  return boardData.statuses.flatMap((status) =>
    status.tasks.map((task) => ({
      ...task,
      key: task._id,
      statusId: status._id,
      statusName: status.name,
      statusColor: status.color,
      statusIsCompleted: status.isCompleted,
    })),
  );
}

export function mapTaskListResponse(
  taskList: TaskListResponse | undefined,
): TaskListRowViewModel[] {
  return (taskList?.tasks ?? []).map((task) => ({
    ...task,
    key: task._id,
  }));
}

export function findTaskColumn(boardData: BoardData | undefined, taskId: string): BoardColumn | undefined {
  return boardData?.statuses.find((status) => status.tasks.some((task) => task._id === taskId));
}

export function findTaskItem(boardData: BoardData | undefined, taskId: string): TaskItem | undefined {
  for (const status of boardData?.statuses ?? []) {
    const task = status.tasks.find((item) => item._id === taskId);
    if (task) {
      return task;
    }
  }

  return undefined;
}

export function buildOverviewTasks(
  boardData: BoardData | undefined,
  fallbackTasks: TaskDetail[] = [],
): TaskListRowViewModel[] {
  const rows = flattenBoardData(boardData)
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
    .slice(0, 10);

  if (rows.length > 0) {
    return rows;
  }

  return fallbackTasks.slice(0, 10).map((task) => ({
    ...task,
    key: task._id,
    statusId: task.status._id,
    statusName: task.status.name,
    statusColor: task.status.color,
    statusIsCompleted: false,
  }));
}

export function flattenMyTaskGroups(
  groups: Array<{
    group: { groupId: string };
    tasks: MyTaskItem[];
  }>,
): MyTaskListRowViewModel[] {
  return groups.flatMap((section) =>
    section.tasks.map((task) => ({
      ...task,
      key: task.taskId,
      groupId: section.group.groupId,
    })),
  );
}
