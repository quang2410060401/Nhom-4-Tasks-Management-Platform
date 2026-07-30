import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query';
import { acceptInviteApi } from '../api';

export function useAcceptInvite() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (token: string) => acceptInviteApi(token),
    onSuccess: (data) => {
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.groups.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.groups.detail(data.groupId) }),
      ]);
    },
  });
}
