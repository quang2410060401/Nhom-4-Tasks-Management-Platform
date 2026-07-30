import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query';
import type { StatusPreset } from '@/types';
import { getStatusPresetsApi } from '../api';

export function useStatusPresets(search: string, enabled = true) {
  return useQuery<StatusPreset[]>({
    queryKey: queryKeys.groups.statusPresets({ search }),
    queryFn: () => getStatusPresetsApi(search),
    enabled,
    staleTime: 60_000,
  });
}
