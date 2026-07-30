import { useMutation, useQueryClient } from '@tanstack/react-query';
import { invalidateMemberRelated } from '@/lib/query';
import { normalizeApiError } from '@/services/http';
import { showApiError, toastService } from '@/services/ui';
import { removeMemberApi } from '../api';

export function useRemoveMember(groupId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (userId: string) => removeMemberApi(groupId, userId),
    onSuccess: async () => {
      toastService.success('Đã xóa thành viên khỏi nhóm');
      await invalidateMemberRelated(queryClient, groupId, { includeTasks: true });
    },
    onError: (error) => {
      showApiError(normalizeApiError(error));
    },
  });
}
