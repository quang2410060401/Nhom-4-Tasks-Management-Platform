import { useMutation, useQueryClient } from '@tanstack/react-query';
import { invalidateTaskRelated, queryKeys } from '@/lib/query';
import { normalizeApiError } from '@/services/http';
import { showApiError, showUpdateSuccess } from '@/services/ui';
import { updateTaskApi } from '../api/taskApi';
import type { UpdateTaskPayload } from '../types';
import type { BoardData, TaskDetail, TaskListResponse } from '@/types';
import {
  isTaskBoardQueryKey,
  isTaskListQueryKey,
  mergeTaskDetail,
  patchBoardTask,
  patchTaskList,
  syncTaskDetailIntoBoards,
  syncTaskDetailIntoLists,
  type TaskOptimisticContext,
} from '../cache';

export function useUpdateTask(groupId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      taskId,
      payload,
    }: {
      taskId: string;
      payload: UpdateTaskPayload;
    }) => updateTaskApi(groupId, taskId, payload),
    onMutate: async ({ taskId, payload }): Promise<TaskOptimisticContext> => {
      await queryClient.cancelQueries({ queryKey: queryKeys.tasks.all(groupId) });

      const boardSnapshots = queryClient.getQueriesData<BoardData>({
        predicate: (query) => isTaskBoardQueryKey(groupId, query.queryKey),
      });
      const listSnapshots = queryClient.getQueriesData<TaskListResponse>({
        predicate: (query) => isTaskListQueryKey(groupId, query.queryKey),
      });
      const detailSnapshot =
        queryClient.getQueryData<TaskDetail>(queryKeys.tasks.detail(groupId, taskId));

      boardSnapshots.forEach(([key]) => {
        queryClient.setQueryData<BoardData>(key, (current) => patchBoardTask(current, taskId, payload));
      });
      listSnapshots.forEach(([key]) => {
        queryClient.setQueryData<TaskListResponse>(key, (current) =>
          patchTaskList(current, taskId, payload),
        );
      });
      queryClient.setQueryData<TaskDetail>(
        queryKeys.tasks.detail(groupId, taskId),
        (current) => mergeTaskDetail(current, payload),
      );

      return { boardSnapshots, listSnapshots, detailSnapshot };
    },
    onSuccess: async (task) => {
      showUpdateSuccess('công việc');
      syncTaskDetailIntoBoards(queryClient, groupId, task);
      syncTaskDetailIntoLists(queryClient, groupId, task);
      await invalidateTaskRelated(queryClient, groupId);
    },
    onError: (error, variables, context) => {
      context?.boardSnapshots.forEach(([key, data]) => {
        queryClient.setQueryData(key, data);
      });
      context?.listSnapshots.forEach(([key, data]) => {
        queryClient.setQueryData(key, data);
      });
      if (variables.taskId) {
        queryClient.setQueryData(
          queryKeys.tasks.detail(groupId, variables.taskId),
          context?.detailSnapshot,
        );
      }
      showApiError(normalizeApiError(error));
    },
  });
}
