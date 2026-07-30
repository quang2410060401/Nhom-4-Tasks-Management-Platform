import { useMutation, useQueryClient } from '@tanstack/react-query';
import { invalidateMemberRelated } from '@/lib/query';
import { normalizeApiError } from '@/services/http';
import { showInviteError, toastService } from '@/services/ui';
import { inviteMemberApi } from '../api';
import type { InviteMemberPayload } from '../types';

export function useInviteMember(groupId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: InviteMemberPayload) => inviteMemberApi(groupId, payload),
    onSuccess: async () => {
      await invalidateMemberRelated(queryClient, groupId);
      toastService.success('Lời mời đã được gửi');
    },
    onError: (error) => {
      showInviteError(normalizeApiError(error));
    },
  });
}
