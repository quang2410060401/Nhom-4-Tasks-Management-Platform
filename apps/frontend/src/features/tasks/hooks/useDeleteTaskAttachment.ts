import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query';
import { normalizeApiError } from '@/services/http';
import { showApiError, showDeleteSuccess } from '@/services/ui';
import { deleteTaskAttachmentApi } from '../api/taskApi';

export function useDeleteTaskAttachment(groupId: string, taskId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (attachmentId: string) =>
      deleteTaskAttachmentApi(groupId, taskId!, attachmentId),
    onSuccess: async () => {
      showDeleteSuccess('tệp đính kèm');
      if (!taskId) return;
      await queryClient.invalidateQueries({ queryKey: queryKeys.tasks.detail(groupId, taskId) });
    },
    onError: (error) => {
      showApiError(normalizeApiError(error));
    },
  });
}
