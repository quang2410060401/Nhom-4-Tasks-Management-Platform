import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { groupDetailPath } from '@/lib/constants/routes';
import {
  invalidateLabelRelated,
  invalidateMemberRelated,
  invalidateStatusRelated,
  queryKeys,
} from '@/lib/query';
import { normalizeApiError } from '@/services/http';
import {
  notificationService,
  showApiError,
  showCreateSuccess,
  showUpdateSuccess,
  toastService,
} from '@/services/ui';
import { createGroupApi, updateGroupApi } from '../api';
import type { GroupEditorPayload, GroupEditorResult } from '../types';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeInviteEmails(inviteEmails: string[]) {
  return [
    ...new Set(
      inviteEmails
        .map((email) => email.trim().toLowerCase())
        .filter(Boolean),
    ),
  ];
}

function buildStatusesPayload(statuses: GroupEditorPayload['statuses']) {
  const normalizedStatuses = statuses
    .map((status) => ({
      _id: status._id,
      name: status.name.trim(),
      color: status.color,
      isCompleted: status.isCompleted,
    }))
    .filter((status) => status.name.length > 0);

  if (normalizedStatuses.length === 0) {
    throw new Error('Nhóm phải có ít nhất 1 status');
  }

  return normalizedStatuses;
}

function buildLabelsPayload(labels: GroupEditorPayload['labels']) {
  return labels
    .map((label) => ({
      _id: label._id,
      name: label.name.trim(),
      color: label.color,
    }))
    .filter((label) => label.name.length > 0);
}

export function useSaveGroupEditor() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  return useMutation<GroupEditorResult, unknown, GroupEditorPayload>({
    mutationFn: async (payload) => {
      const trimmedName = payload.name.trim();
      if (!trimmedName) {
        throw new Error('Tên nhóm không được để trống');
      }

      const inviteEmails = normalizeInviteEmails(payload.inviteEmails);
      const invalidEmails = inviteEmails.filter((email) => !EMAIL_REGEX.test(email));

      if (invalidEmails.length > 0) {
        throw new Error(`Email không hợp lệ: ${invalidEmails.join(', ')}`);
      }

      const aggregatePayload = {
        name: trimmedName,
        description: payload.description.trim() || undefined,
        startDate: payload.startDate || undefined,
        endDate: payload.endDate || undefined,
        statuses: buildStatusesPayload(payload.statuses),
        labels: buildLabelsPayload(payload.labels),
        inviteEmails,
      };

      if (payload.mode === 'create') {
        const createdGroup = await createGroupApi(aggregatePayload);
        return {
          groupId: createdGroup._id,
          inviteSummary: createdGroup.inviteSummary,
        };
      }

      if (!payload.groupId) {
        throw new Error('Thiếu groupId để lưu thay đổi');
      }

      const updatedGroup = await updateGroupApi(payload.groupId, {
        ...aggregatePayload,
        description: payload.description.trim() || null,
        startDate: payload.startDate || null,
        endDate: payload.endDate || null,
        removeMemberUserIds:
          payload.removedMemberUserIds && payload.removedMemberUserIds.length > 0
            ? [...new Set(payload.removedMemberUserIds)]
            : undefined,
      });

      return {
        groupId: updatedGroup._id,
        inviteSummary: updatedGroup.inviteSummary,
      };
    },
    onSuccess: async (result, variables) => {
      const groupId = result.groupId;

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.groups.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.groups.detail(groupId) }),
        invalidateStatusRelated(queryClient, groupId),
        invalidateLabelRelated(queryClient, groupId),
        invalidateMemberRelated(queryClient, groupId, {
          includeTasks: Boolean(variables.removedMemberUserIds?.length),
        }),
      ]);

      if (variables.mode === 'create') {
        showCreateSuccess('nhóm');
        navigate(groupDetailPath(groupId), { replace: true });
      } else {
        showUpdateSuccess('nhóm');
      }

      if (result.inviteSummary.failedEmails.length > 0) {
        notificationService.warning({
          message: 'Nhóm đã được lưu nhưng một số email mời gửi thất bại',
          description: result.inviteSummary.failedEmails.join(', '),
          duration: 6,
        });
      }
    },
    onError: (error) => {
      if (error instanceof Error && !('isAxiosError' in error)) {
        toastService.error(error.message);
        return;
      }

      showApiError(normalizeApiError(error));
    },
  });
}
