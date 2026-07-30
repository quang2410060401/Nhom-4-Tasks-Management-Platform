import type {
  GroupCreateResponse,
  GroupDetail,
  GroupInvite,
  GroupListItem,
  GroupMemberPreview,
  GroupMember,
  GroupRole,
  InviteSummary,
  GroupUpdateResponse,
  InviteAcceptResponse,
  LabelPreset,
  MemberCandidate,
  StatusPreset,
  TaskLabel,
  TaskStatus,
} from '@/types';

export interface CreateGroupFormValues {
  name: string;
  description: string;
  startDate: string;
  endDate: string;
}

export interface InviteMemberFormValues {
  email: string;
  role: Extract<GroupRole, 'admin' | 'member'>;
}

export interface CreateGroupPayload {
  name: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  statuses?: GroupStatusInputPayload[];
  labels?: GroupLabelInputPayload[];
  inviteEmails?: string[];
}

export interface UpdateGroupPayload {
  name?: string;
  description?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  statuses?: GroupStatusInputPayload[];
  labels?: GroupLabelInputPayload[];
  inviteEmails?: string[];
  removeMemberUserIds?: string[];
}

export interface InviteMemberPayload {
  email: string;
  role?: Extract<GroupRole, 'admin' | 'member'>;
}

export interface UpdateMemberRolePayload {
  role: Extract<GroupRole, 'admin' | 'member'>;
}

export type CreateGroupResult = GroupCreateResponse;

export type UpdateGroupResult = GroupUpdateResponse;

export interface GroupStatusInputPayload {
  _id?: string;
  name: string;
  color?: string;
  isCompleted?: boolean;
}

export interface GroupLabelInputPayload {
  _id?: string;
  name: string;
  color?: string;
}

export interface CreateStatusPayload {
  name: string;
  color?: string;
  order?: number;
  isCompleted?: boolean;
}

export interface UpdateStatusPayload {
  name?: string;
  color?: string;
  order?: number;
  isCompleted?: boolean;
}

export interface CreateLabelPayload {
  name: string;
  color?: string;
}

export interface UpdateLabelPayload {
  name?: string;
  color?: string;
}

export type GroupEditorMode = 'create' | 'edit';

export interface GroupStatusDraft {
  key: string;
  _id?: string;
  name: string;
  color: string;
  isCompleted: boolean;
  isDefault: boolean;
  source: 'seeded-default' | 'existing' | 'preset' | 'manual';
}

export interface GroupLabelDraft {
  key: string;
  _id?: string;
  name: string;
  color: string;
  source: 'existing' | 'preset' | 'manual';
}

export interface GroupMemberDraft {
  key: string;
  email: string;
  name: string;
  avatar: string | null;
  userId?: string;
}

export interface GroupEditorPayload {
  mode: GroupEditorMode;
  groupId?: string;
  name: string;
  description: string;
  startDate: string;
  endDate: string;
  statuses: GroupStatusDraft[];
  labels: GroupLabelDraft[];
  inviteEmails: string[];
  removedMemberUserIds?: string[];
}

export interface GroupEditorResult {
  groupId: string;
  inviteSummary: InviteSummary;
}

export type GroupCardTone = 'primary' | 'indigo' | 'emerald' | 'amber' | 'rose' | 'cyan';

export interface GroupCardViewModel extends GroupListItem {
  tone: GroupCardTone;
  summary: string;
}

export interface MemberListItemViewModel extends GroupMember {
  initials: string;
  isOwner: boolean;
  isAdmin: boolean;
  isManager: boolean;
}

export interface PendingInviteListItemViewModel extends GroupInvite {
  displayName: string;
  initials: string;
}

export type {
  GroupDetail,
  GroupInvite,
  GroupListItem,
  GroupMemberPreview,
  GroupMember,
  GroupRole,
  InviteAcceptResponse,
  InviteSummary,
  TaskStatus,
  TaskLabel,
  StatusPreset,
  LabelPreset,
  MemberCandidate,
};

const GROUP_CARD_TONES: GroupCardTone[] = ['primary', 'indigo', 'emerald', 'amber', 'rose', 'cyan'];

function hashString(value: string): number {
  return value.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
}

export function getInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

export function buildGroupCardViewModel(group: GroupListItem): GroupCardViewModel {
  const tone = GROUP_CARD_TONES[hashString(group.name) % GROUP_CARD_TONES.length];
  const summary =
    group.description?.trim() ||
    (group.memberCount > 1
      ? `${group.memberCount} thành viên đang cộng tác trong không gian làm việc của nhóm ${group.name}.`
      : `Không gian làm việc của nhóm ${group.name} đã sẵn sàng để bắt đầu cộng tác.`);

  return {
    ...group,
    tone,
    summary,
  };
}

export function buildMemberListItemViewModel(member: GroupMember): MemberListItemViewModel {
  return {
    ...member,
    initials: getInitials(member.name),
    isOwner: member.role === 'owner',
    isAdmin: member.role === 'admin',
    isManager: member.role === 'owner' || member.role === 'admin',
  };
}

export function buildPendingInviteListItemViewModel(
  invite: GroupInvite,
): PendingInviteListItemViewModel {
  const displayName = invite.name?.trim() || invite.email;

  return {
    ...invite,
    displayName,
    initials: getInitials(displayName.includes('@') ? displayName.split('@')[0] : displayName),
  };
}

function createDraftKey(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

export function createDefaultStatusDrafts(): GroupStatusDraft[] {
  return [
    {
      key: createDraftKey('status'),
      name: 'Todo',
      color: '#3B82F6',
      isCompleted: false,
      isDefault: true,
      source: 'seeded-default',
    },
    {
      key: createDraftKey('status'),
      name: 'Doing',
      color: '#F59E0B',
      isCompleted: false,
      isDefault: false,
      source: 'seeded-default',
    },
    {
      key: createDraftKey('status'),
      name: 'Done',
      color: '#10B981',
      isCompleted: true,
      isDefault: false,
      source: 'seeded-default',
    },
  ];
}

export function buildStatusDraftFromStatus(status: TaskStatus): GroupStatusDraft {
  return {
    key: createDraftKey('status'),
    _id: status._id,
    name: status.name,
    color: status.color,
    isCompleted: status.isCompleted,
    isDefault: status.isDefault,
    source: 'existing',
  };
}

export function buildStatusDraftFromPreset(status: StatusPreset): GroupStatusDraft {
  return {
    key: createDraftKey('status'),
    name: status.name,
    color: status.color,
    isCompleted: status.isCompleted,
    isDefault: false,
    source: 'preset',
  };
}

export function buildLabelDraftFromLabel(label: TaskLabel): GroupLabelDraft {
  return {
    key: createDraftKey('label'),
    _id: label._id,
    name: label.name,
    color: label.color,
    source: 'existing',
  };
}

export function buildLabelDraftFromPreset(label: LabelPreset): GroupLabelDraft {
  return {
    key: createDraftKey('label'),
    name: label.name,
    color: label.color,
    source: 'preset',
  };
}

export function buildMemberDraftFromCandidate(candidate: MemberCandidate): GroupMemberDraft {
  return {
    key: createDraftKey('member'),
    email: candidate.email,
    name: candidate.name,
    avatar: candidate.avatar,
    userId: candidate.userId,
  };
}
