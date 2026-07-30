import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query';
import type { GroupListItem } from '@/types';
import { getGroupsApi } from '../api';

export function useGroups() {
  return useQuery<GroupListItem[]>({
    queryKey: queryKeys.groups.list(),
    queryFn: getGroupsApi,
    staleTime: 60_000,
  });
}
