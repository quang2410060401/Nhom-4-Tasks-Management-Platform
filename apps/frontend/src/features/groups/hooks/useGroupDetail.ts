import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query';
import type { GroupDetail } from '@/types';
import { getGroupDetailApi } from '../api';

export function useGroupDetail(groupId: string | undefined) {
  return useQuery<GroupDetail>({
    queryKey: groupId ? queryKeys.groups.detail(groupId) : queryKeys.groups.detail('unknown'),
    queryFn: () => getGroupDetailApi(groupId!),
    enabled: Boolean(groupId),
    staleTime: 60_000,
  });
}
