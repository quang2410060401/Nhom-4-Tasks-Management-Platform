import type { QueryClient, QueryKey } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query';
import type { BoardData, TaskDetail, TaskItem, TaskListResponse } from '@/types';
import type { UpdateTaskPayload } from './types';

export function isTaskBoardQueryKey(groupId: string, queryKey: QueryKey): boolean {
  return (
    Array.isArray(queryKey) &&
    queryKey[0] === 'groups' &&
    queryKey[1] === groupId &&
    queryKey[2] === 'tasks' &&
    queryKey[3] === 'board'
  );
}

export function isTaskListQueryKey(groupId: string, queryKey: QueryKey): boolean {
  return (
    Array.isArray(queryKey) &&
    queryKey[0] === 'groups' &&
    queryKey[1] === groupId &&
    queryKey[2] === 'tasks' &&
    queryKey[3] === 'list'
  );
}

function mapTaskDetailToItem(task: TaskDetail): TaskItem {
  return {
    _id: task._id,
    title: task.title,
    description: task.description,
    assignee: task.assignee,
    deadline: task.deadline,
    labels: task.labels,
    createdAt: task.createdAt,
  };
}

export function patchBoardTask(
  boardData: BoardData | undefined,
  taskId: string,
  payload: UpdateTaskPayload,
): BoardData | undefined {
  if (!boardData || !Array.isArray(boardData.statuses)) {
    return boardData;
  }

  let sourceColumnIndex = -1;
  let sourceTaskIndex = -1;
  const columns = boardData.statuses.map((status, columnIndex) => {
    const taskIndex = status.tasks.findIndex((task) => task._id === taskId);
    if (taskIndex >= 0) {
      sourceColumnIndex = columnIndex;
      sourceTaskIndex = taskIndex;
    }
    return { ...status, tasks: [...status.tasks] };
  });

  if (sourceColumnIndex < 0 || sourceTaskIndex < 0) {
    return boardData;
  }

  const sourceColumn = columns[sourceColumnIndex];
  const currentTask = sourceColumn.tasks[sourceTaskIndex];
  const nextTask: TaskItem = {
    ...currentTask,
    title: payload.title ?? currentTask.title,
    description:
      payload.description !== undefined ? payload.description : currentTask.description,
    assignee:
      payload.assigneeId === undefined
        ? currentTask.assignee
        : payload.assigneeId === null
          ? null
          : currentTask.assignee,
    deadline: payload.deadline !== undefined ? payload.deadline : currentTask.deadline,
    labels: payload.labelIds !== undefined ? currentTask.labels : currentTask.labels,
  };

  const nextStatusId = payload.statusId ?? columns[sourceColumnIndex]._id;
  sourceColumn.tasks.splice(sourceTaskIndex, 1);

  const targetColumn = columns.find((status) => status._id === nextStatusId);
  if (targetColumn) {
    targetColumn.tasks.push(nextTask);
  } else {
    sourceColumn.tasks.splice(sourceTaskIndex, 0, nextTask);
  }

  return { statuses: columns };
}

export function patchTaskList(
  taskList: TaskListResponse | undefined,
  taskId: string,
  payload: UpdateTaskPayload,
): TaskListResponse | undefined {
  if (!taskList?.tasks) {
    return taskList;
  }

  return {
    tasks: taskList.tasks.map((task) => {
      if (task._id !== taskId) {
        return task;
      }

      return {
        ...task,
        title: payload.title ?? task.title,
        description: payload.description !== undefined ? payload.description : task.description,
        assignee:
          payload.assigneeId === undefined
            ? task.assignee
            : payload.assigneeId === null
              ? null
              : task.assignee,
        deadline: payload.deadline !== undefined ? payload.deadline : task.deadline,
      };
    }),
  };
}

export function mergeTaskDetail(
  current: TaskDetail | undefined,
  payload: UpdateTaskPayload,
): TaskDetail | undefined {
  if (!current) {
    return current;
  }

  return {
    ...current,
    title: payload.title ?? current.title,
    description:
      payload.description !== undefined ? payload.description : current.description,
    assignee:
      payload.assigneeId === undefined
        ? current.assignee
        : payload.assigneeId === null
          ? null
          : current.assignee,
    deadline: payload.deadline !== undefined ? payload.deadline : current.deadline,
    labels: payload.labelIds !== undefined ? current.labels : current.labels,
  };
}

export function syncTaskDetailIntoBoards(
  queryClient: QueryClient,
  groupId: string,
  task: TaskDetail,
) {
  queryClient.setQueriesData<BoardData>(
    { predicate: (query) => isTaskBoardQueryKey(groupId, query.queryKey) },
    (current) => {
      if (!current || !Array.isArray(current.statuses)) {
        return current;
      }

      const mappedTask = mapTaskDetailToItem(task);
      const columns = current.statuses.map((status) => ({
        ...status,
        tasks: status.tasks.filter((item) => item._id !== task._id),
      }));
      const targetColumn = columns.find((status) => status._id === task.status._id);
      if (targetColumn) {
        targetColumn.tasks.push(mappedTask);
      }
      return { statuses: columns };
    },
  );

  queryClient.setQueryData<TaskDetail>(queryKeys.tasks.detail(groupId, task._id), task);
}

export function syncTaskDetailIntoLists(
  queryClient: QueryClient,
  groupId: string,
  task: TaskDetail,
) {
  queryClient.setQueriesData<TaskListResponse>(
    { predicate: (query) => isTaskListQueryKey(groupId, query.queryKey) },
    (current) => {
      if (!current?.tasks) {
        return current;
      }

      return {
        tasks: current.tasks.map((item) =>
          item._id === task._id
            ? {
                ...item,
                title: task.title,
                description: task.description,
                assignee: task.assignee,
                deadline: task.deadline,
                labels: task.labels,
                statusId: task.status._id,
                statusName: task.status.name,
                statusColor: task.status.color,
              }
            : item,
        ),
      };
    },
  );
}

export interface TaskOptimisticContext {
  boardSnapshots: Array<[QueryKey, BoardData | undefined]>;
  listSnapshots: Array<[QueryKey, TaskListResponse | undefined]>;
  detailSnapshot: TaskDetail | undefined;
}
