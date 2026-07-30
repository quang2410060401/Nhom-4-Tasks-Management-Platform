import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query';
import type { MemberCandidate } from '@/types';
import { getMemberCandidatesApi } from '../api';

export function useMemberCandidates(search: string, enabled = true) {
  return useQuery<MemberCandidate[]>({
    queryKey: queryKeys.groups.memberCandidates({ search }),
    queryFn: () => getMemberCandidatesApi(search),
    enabled,
    staleTime: 60_000,
  });
}
