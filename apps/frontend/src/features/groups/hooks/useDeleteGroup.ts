import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '@/lib/constants/routes';
import { queryKeys } from '@/lib/query';
import { normalizeApiError } from '@/services/http';
import { showApiError, showDeleteSuccess } from '@/services/ui';
import { deleteGroupApi } from '../api';

export function useDeleteGroup(groupId: string) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  return useMutation({
    mutationFn: () => deleteGroupApi(groupId),
    onSuccess: async () => {
      queryClient.removeQueries({ queryKey: queryKeys.groups.detail(groupId) });
      queryClient.removeQueries({ queryKey: queryKeys.members.all(groupId) });
      queryClient.removeQueries({ queryKey: queryKeys.invites.all(groupId) });
      queryClient.removeQueries({ queryKey: queryKeys.tasks.all(groupId) });
      queryClient.removeQueries({ queryKey: queryKeys.statuses.all(groupId) });
      queryClient.removeQueries({ queryKey: queryKeys.labels.all(groupId) });
      queryClient.removeQueries({ queryKey: queryKeys.dashboard.all(groupId) });
      queryClient.removeQueries({ queryKey: queryKeys.dashboard.me() });
      await queryClient.invalidateQueries({ queryKey: queryKeys.groups.all });
      showDeleteSuccess('nhóm');
      navigate(ROUTES.GROUPS, { replace: true });
    },
    onError: (error) => {
      showApiError(normalizeApiError(error));
    },
  });
}
