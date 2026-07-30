import { apiClient, unwrapResponse } from '@/services/http';
import type { ApiResponse } from '@/services/http';
import type {
  GroupDetail,
  GroupListItem,
  GroupCreateResponse,
  InviteAcceptResponse,
  LabelPreset,
  MemberCandidate,
  StatusPreset,
  TaskLabel,
  TaskStatus,
  GroupUpdateResponse,
} from '@/types';
import type {
  CreateLabelPayload,
  CreateGroupPayload,
  CreateGroupResult,
  CreateStatusPayload,
  InviteMemberPayload,
  UpdateMemberRolePayload,
  UpdateGroupPayload,
  UpdateLabelPayload,
  UpdateStatusPayload,
} from '../types';

export function getGroupsApi(): Promise<GroupListItem[]> {
  return unwrapResponse(apiClient.get<ApiResponse<GroupListItem[]>>('/groups'));
}

export function createGroupApi(data: CreateGroupPayload): Promise<CreateGroupResult> {
  return unwrapResponse(apiClient.post<ApiResponse<GroupCreateResponse>>('/groups', data));
}

export function updateGroupApi(groupId: string, data: UpdateGroupPayload): Promise<GroupUpdateResponse> {
  return unwrapResponse(apiClient.patch<ApiResponse<GroupUpdateResponse>>(`/groups/${groupId}`, data));
}

export function deleteGroupApi(groupId: string): Promise<void> {
  return apiClient.delete(`/groups/${groupId}`).then(() => undefined);
}

export function getGroupDetailApi(groupId: string): Promise<GroupDetail> {
  return unwrapResponse(apiClient.get<ApiResponse<GroupDetail>>(`/groups/${groupId}`));
}

export function getGroupStatusesApi(groupId: string): Promise<TaskStatus[]> {
  return unwrapResponse(apiClient.get<ApiResponse<TaskStatus[]>>(`/groups/${groupId}/statuses`));
}

export function createGroupStatusApi(groupId: string, data: CreateStatusPayload): Promise<TaskStatus> {
  return unwrapResponse(apiClient.post<ApiResponse<TaskStatus>>(`/groups/${groupId}/statuses`, data));
}

export function updateGroupStatusApi(
  groupId: string,
  statusId: string,
  data: UpdateStatusPayload,
): Promise<TaskStatus> {
  return unwrapResponse(
    apiClient.patch<ApiResponse<TaskStatus>>(`/groups/${groupId}/statuses/${statusId}`, data),
  );
}

export function deleteGroupStatusApi(groupId: string, statusId: string): Promise<void> {
  return apiClient.delete(`/groups/${groupId}/statuses/${statusId}`).then(() => undefined);
}

export function getGroupLabelsApi(groupId: string): Promise<TaskLabel[]> {
  return unwrapResponse(apiClient.get<ApiResponse<TaskLabel[]>>(`/groups/${groupId}/labels`));
}

export function createGroupLabelApi(groupId: string, data: CreateLabelPayload): Promise<TaskLabel> {
  return unwrapResponse(apiClient.post<ApiResponse<TaskLabel>>(`/groups/${groupId}/labels`, data));
}

export function updateGroupLabelApi(
  groupId: string,
  labelId: string,
  data: UpdateLabelPayload,
): Promise<TaskLabel> {
  return unwrapResponse(
    apiClient.patch<ApiResponse<TaskLabel>>(`/groups/${groupId}/labels/${labelId}`, data),
  );
}

export function deleteGroupLabelApi(groupId: string, labelId: string): Promise<void> {
  return apiClient.delete(`/groups/${groupId}/labels/${labelId}`).then(() => undefined);
}

export function getStatusPresetsApi(search?: string, limit = 12): Promise<StatusPreset[]> {
  return unwrapResponse(
    apiClient.get<ApiResponse<StatusPreset[]>>('/groups/status-presets', {
      params: { search: search || undefined, limit },
    }),
  );
}

export function getLabelPresetsApi(search?: string, limit = 12): Promise<LabelPreset[]> {
  return unwrapResponse(
    apiClient.get<ApiResponse<LabelPreset[]>>('/groups/label-presets', {
      params: { search: search || undefined, limit },
    }),
  );
}

export function getMemberCandidatesApi(search?: string, limit = 12): Promise<MemberCandidate[]> {
  return unwrapResponse(
    apiClient.get<ApiResponse<MemberCandidate[]>>('/groups/member-candidates', {
      params: { search: search || undefined, limit },
    }),
  );
}

export function inviteMemberApi(groupId: string, data: InviteMemberPayload): Promise<void> {
  return apiClient.post(`/groups/${groupId}/invites`, data).then(() => undefined);
}

export function updateMemberRoleApi(
  groupId: string,
  userId: string,
  data: UpdateMemberRolePayload,
): Promise<void> {
  return apiClient.patch(`/groups/${groupId}/members/${userId}/role`, data).then(() => undefined);
}

export function revokeInviteApi(groupId: string, inviteId: string): Promise<void> {
  return apiClient.delete(`/groups/${groupId}/invites/${inviteId}`).then(() => undefined);
}

export function removeMemberApi(groupId: string, userId: string): Promise<void> {
  return apiClient.delete(`/groups/${groupId}/members/${userId}`).then(() => undefined);
}

export function acceptInviteApi(token: string): Promise<InviteAcceptResponse> {
  return unwrapResponse(
    apiClient.post<ApiResponse<InviteAcceptResponse>>('/groups/invites/accept', { token }),
  );
}
