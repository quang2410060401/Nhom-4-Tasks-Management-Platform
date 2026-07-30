import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query';
import type { TaskLabel } from '@/types';
import { getGroupLabelsApi } from '../api';

export function useGroupLabels(groupId: string | undefined, enabled = true) {
  return useQuery<TaskLabel[]>({
    queryKey: groupId ? queryKeys.labels.list(groupId) : queryKeys.labels.list('unknown'),
    queryFn: () => getGroupLabelsApi(groupId!),
    enabled: Boolean(groupId) && enabled,
    staleTime: 60_000,
  });
}
