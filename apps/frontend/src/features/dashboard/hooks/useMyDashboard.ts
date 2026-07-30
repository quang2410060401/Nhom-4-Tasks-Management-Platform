import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query';
import type { MyDashboardData } from '@/types';
import { getMyDashboardApi } from '../api';

export function useMyDashboard() {
  return useQuery<MyDashboardData>({
    queryKey: queryKeys.dashboard.me(),
    queryFn: getMyDashboardApi,
    staleTime: 60_000,
  });
}
