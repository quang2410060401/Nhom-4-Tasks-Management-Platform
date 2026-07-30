import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query';
import type { MyTaskListResponse } from '@/types';
import { getMyTasksApi } from '../api/taskApi';
import type { MyTaskFilters } from '../types';

export function useMyTasks(filters: MyTaskFilters) {
  return useQuery<MyTaskListResponse>({
    queryKey: queryKeys.tasks.my(filters as Record<string, unknown>),
    queryFn: () => getMyTasksApi(filters),
    staleTime: 30_000,
  });
}
