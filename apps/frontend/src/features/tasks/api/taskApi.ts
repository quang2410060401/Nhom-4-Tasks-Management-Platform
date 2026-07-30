import { apiClient, unwrapResponse } from '@/services/http';
import type { ApiResponse } from '@/services/http';
import type {
  BoardData,
  MyTaskListResponse,
  TaskAttachment,
  TaskComment,
  TaskDetail,
  TaskListResponse,
} from '@/types';
import type {
  CreateTaskCommentPayload,
  CreateTaskPayload,
  MyTaskFilters,
  TaskBoardFilters,
  UpdateTaskCommentPayload,
  UpdateTaskPayload,
} from '../types';

function buildTaskParams(filters: TaskBoardFilters) {
  return {
    search: filters.q || undefined,
    assigneeIds: filters.assigneeIds?.length ? filters.assigneeIds : undefined,
    statusIds: filters.statusIds?.length ? filters.statusIds : undefined,
    labelIds: filters.labelIds?.length ? filters.labelIds : undefined,
    dateFrom: filters.dateFrom || undefined,
    dateTo: filters.dateTo || undefined,
  };
}

function buildMyTaskParams(filters: MyTaskFilters) {
  return {
    q: filters.q || undefined,
    groupIds: filters.groupIds?.length ? filters.groupIds : undefined,
    statusIds: filters.statusIds?.length ? filters.statusIds : undefined,
    labelIds: filters.labelIds?.length ? filters.labelIds : undefined,
    dateFrom: filters.dateFrom || undefined,
    dateTo: filters.dateTo || undefined,
  };
}

export function getTaskBoardApi(groupId: string, filters: TaskBoardFilters): Promise<BoardData> {
  return unwrapResponse(
    apiClient.get<ApiResponse<BoardData>>(`/groups/${groupId}/tasks`, {
      params: buildTaskParams(filters),
    }),
  );
}

export function getTaskListApi(
  groupId: string,
  filters: TaskBoardFilters,
): Promise<TaskListResponse> {
  return unwrapResponse(
    apiClient.get<ApiResponse<TaskListResponse>>(`/groups/${groupId}/tasks/list`, {
      params: buildTaskParams(filters),
    }),
  );
}

export function getMyTasksApi(filters: MyTaskFilters): Promise<MyTaskListResponse> {
  return unwrapResponse(
    apiClient.get<ApiResponse<MyTaskListResponse>>('/tasks/my', {
      params: buildMyTaskParams(filters),
    }),
  );
}

export function getTaskDetailApi(groupId: string, taskId: string): Promise<TaskDetail> {
  return unwrapResponse(
    apiClient.get<ApiResponse<TaskDetail>>(`/groups/${groupId}/tasks/${taskId}`),
  );
}

export function createTaskApi(groupId: string, payload: CreateTaskPayload): Promise<TaskDetail> {
  return unwrapResponse(
    apiClient.post<ApiResponse<TaskDetail>>(`/groups/${groupId}/tasks`, payload),
  );
}

export function updateTaskApi(
  groupId: string,
  taskId: string,
  payload: UpdateTaskPayload,
): Promise<TaskDetail> {
  return unwrapResponse(
    apiClient.patch<ApiResponse<TaskDetail>>(`/groups/${groupId}/tasks/${taskId}`, payload),
  );
}

export async function deleteTaskApi(groupId: string, taskId: string): Promise<void> {
  await unwrapResponse(apiClient.delete<ApiResponse<null>>(`/groups/${groupId}/tasks/${taskId}`));
}

export function getTaskCommentsApi(groupId: string, taskId: string): Promise<TaskComment[]> {
  return unwrapResponse(
    apiClient.get<ApiResponse<TaskComment[]>>(`/groups/${groupId}/tasks/${taskId}/comments`),
  );
}

export function createTaskCommentApi(
  groupId: string,
  taskId: string,
  payload: CreateTaskCommentPayload,
): Promise<TaskComment> {
  return unwrapResponse(
    apiClient.post<ApiResponse<TaskComment>>(`/groups/${groupId}/tasks/${taskId}/comments`, payload),
  );
}

export function updateTaskCommentApi(
  groupId: string,
  taskId: string,
  commentId: string,
  payload: UpdateTaskCommentPayload,
): Promise<TaskComment> {
  return unwrapResponse(
    apiClient.patch<ApiResponse<TaskComment>>(
      `/groups/${groupId}/tasks/${taskId}/comments/${commentId}`,
      payload,
    ),
  );
}

export async function deleteTaskCommentApi(
  groupId: string,
  taskId: string,
  commentId: string,
): Promise<void> {
  await unwrapResponse(
    apiClient.delete<ApiResponse<null>>(`/groups/${groupId}/tasks/${taskId}/comments/${commentId}`),
  );
}

export function uploadTaskAttachmentsApi(
  groupId: string,
  taskId: string,
  files: File[],
): Promise<TaskAttachment[]> {
  const formData = new FormData();
  files.forEach((file) => formData.append('files', file));

  return unwrapResponse(
    apiClient.post<ApiResponse<TaskAttachment[]>>(
      `/groups/${groupId}/tasks/${taskId}/attachments`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      },
    ),
  );
}

export async function deleteTaskAttachmentApi(
  groupId: string,
  taskId: string,
  attachmentId: string,
): Promise<void> {
  await unwrapResponse(
    apiClient.delete<ApiResponse<null>>(
      `/groups/${groupId}/tasks/${taskId}/attachments/${attachmentId}`,
    ),
  );
}

export async function downloadTaskAttachmentApi(
  groupId: string,
  taskId: string,
  attachmentId: string,
  originalName: string,
): Promise<void> {
  const blob = await getTaskAttachmentBlobApi(groupId, taskId, attachmentId);
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = originalName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(url);
}

export async function getTaskAttachmentBlobApi(
  groupId: string,
  taskId: string,
  attachmentId: string,
): Promise<Blob> {
  const response = await apiClient.get<Blob>(
    `/groups/${groupId}/tasks/${taskId}/attachments/${attachmentId}`,
    { responseType: 'blob' },
  );
  return response.data;
}
