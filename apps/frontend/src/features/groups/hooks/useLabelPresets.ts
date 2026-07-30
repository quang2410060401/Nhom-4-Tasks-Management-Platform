import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query';
import type { LabelPreset } from '@/types';
import { getLabelPresetsApi } from '../api';

export function useLabelPresets(search: string, enabled = true) {
  return useQuery<LabelPreset[]>({
    queryKey: queryKeys.groups.labelPresets({ search }),
    queryFn: () => getLabelPresetsApi(search),
    enabled,
    staleTime: 60_000,
  });
}
