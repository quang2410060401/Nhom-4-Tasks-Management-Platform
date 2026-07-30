import { useMutation, useQueryClient } from '@tanstack/react-query';
import { invalidateMemberRelated } from '@/lib/query';
import { normalizeApiError } from '@/services/http';
import { showApiError, toastService } from '@/services/ui';
import { revokeInviteApi } from '../api';

export function useRevokeInvite(groupId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (inviteId: string) => revokeInviteApi(groupId, inviteId),
    onSuccess: async () => {
      toastService.success('Đã thu hồi lời mời');
      await invalidateMemberRelated(queryClient, groupId);
    },
    onError: (error) => {
      showApiError(normalizeApiError(error));
    },
  });
}
