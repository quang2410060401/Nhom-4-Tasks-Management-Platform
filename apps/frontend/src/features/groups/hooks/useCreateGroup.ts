import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { queryKeys } from '@/lib/query';
import { groupDetailPath } from '@/lib/constants/routes';
import { normalizeApiError } from '@/services/http';
import { showApiError, showCreateSuccess } from '@/services/ui';
import { createGroupApi } from '../api';
import type { CreateGroupPayload } from '../types';

export function useCreateGroup() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  return useMutation({
    mutationFn: (payload: CreateGroupPayload) => createGroupApi(payload),
    onSuccess: async (group) => {
      showCreateSuccess('nhóm');
      await queryClient.invalidateQueries({ queryKey: queryKeys.groups.all });
      navigate(groupDetailPath(group._id), { replace: true });
    },
    onError: (error) => {
      showApiError(normalizeApiError(error));
    },
  });
}
