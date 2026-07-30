import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query';
import type { DashboardData } from '@/types';
import { getGroupDashboardApi } from '../api';

export function useGroupDashboard(groupId: string | undefined) {
  return useQuery<DashboardData>({
    queryKey: groupId ? queryKeys.dashboard.summary(groupId) : queryKeys.dashboard.summary('unknown'),
    queryFn: () => getGroupDashboardApi(groupId!),
    enabled: Boolean(groupId),
    staleTime: 60_000,
  });
}
