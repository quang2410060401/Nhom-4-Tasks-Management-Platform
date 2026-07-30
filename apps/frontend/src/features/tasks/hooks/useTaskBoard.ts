import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query';
import type { BoardData } from '@/types';
import { getTaskBoardApi } from '../api/taskApi';
import type { TaskBoardFilters } from '../types';

export function useTaskBoard(
  groupId: string | undefined,
  filters: TaskBoardFilters,
  enabled = true,
) {
  return useQuery<BoardData>({
    queryKey: groupId
      ? queryKeys.tasks.board(groupId, filters as Record<string, unknown>)
      : queryKeys.tasks.board('unknown', filters as Record<string, unknown>),
    queryFn: () => getTaskBoardApi(groupId!, filters),
    enabled: Boolean(groupId) && enabled,
    staleTime: 30_000,
  });
}
