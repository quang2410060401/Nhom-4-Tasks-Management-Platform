import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query';
import { normalizeApiError } from '@/services/http';
import { showApiError } from '@/services/ui';
import { uploadTaskAttachmentsApi } from '../api/taskApi';

export function useUploadTaskAttachments(groupId: string, taskId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (files: File[]) => uploadTaskAttachmentsApi(groupId, taskId!, files),
    onSuccess: async () => {
      if (!taskId) return;
      await queryClient.invalidateQueries({ queryKey: queryKeys.tasks.detail(groupId, taskId) });
    },
    onError: (error) => {
      showApiError(normalizeApiError(error));
    },
  });
}
