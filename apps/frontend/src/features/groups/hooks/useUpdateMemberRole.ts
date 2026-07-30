import { useMutation, useQueryClient } from '@tanstack/react-query';
import { invalidateMemberRelated } from '@/lib/query';
import { normalizeApiError } from '@/services/http';
import { showApiError, toastService } from '@/services/ui';
import { updateMemberRoleApi } from '../api';
import type { UpdateMemberRolePayload } from '../types';

export function useUpdateMemberRole(groupId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      userId,
      payload,
    }: {
      userId: string;
      payload: UpdateMemberRolePayload;
    }) => updateMemberRoleApi(groupId, userId, payload),
    onSuccess: async () => {
      toastService.success('Đã cập nhật vai trò thành viên');
      await invalidateMemberRelated(queryClient, groupId);
    },
    onError: (error) => {
      showApiError(normalizeApiError(error));
    },
  });
}
