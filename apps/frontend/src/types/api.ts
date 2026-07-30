/* ─────────────────────────────────────────────────────────────────
 * Shared API Domain Types — response models từ backend
 * ─────────────────────────────────────────────────────────────────
 * QUAN TRỌNG — GIỮ NGUYÊN TÊN FIELD TỪ BACKEND:
 *
 * Các interface ở đây phản ánh ĐÚNG shape trả về từ API.
 * Không đổi tên field (vd: creatorId → createdBy, inviteToken → token).
 * Nếu cần tên khác cho UI, map TRONG feature hook/adapter.
 *
 * Xem: .github/docs/api-specification.md
 * ─────────────────────────────────────────────────────────────────
 * File này chứa domain model types dùng chung giữa nhiều features.
 * Feature-specific types nên ở feature/types.ts.
 * Transport types (ApiResponse, NormalizedApiError...) nằm ở
 * src/services/http/httpTypes.ts — re-export ở đây cho tiện import.
 * ───────────────────────────────────────────────────────────────── */

// Re-export transport types để giữ ổn định import path @/types
export type {
  ApiResponse,
  ApiErrorResponse,
  PaginationMeta,
  PaginatedData,
  PaginationParams,
  NormalizedApiError,
} from '@/services/http/httpTypes';

// ──── User ────

/** User cơ bản trả về từ login / me */
export interface UserProfile {
  _id: string;
  name: string;
  email: string;
  avatar: string | null;
}

/** User đầy đủ từ GET /auth/me */
export interface UserMe extends UserProfile {
  emailVerified: boolean;
}

/** Login response data */
export interface LoginResponse {
  accessToken: string;
  user: UserProfile;
}

// ──── Group ────

export type GroupRole = 'owner' | 'admin' | 'member';
export type InviteStatus = 'pending' | 'accepted' | 'expired';

export interface GroupPermissions {
  canEditGroup: boolean;
  canDeleteGroup: boolean;
  canInviteMembers: boolean;
  canManageMembers: boolean;
  canManageRoles: boolean;
  canManageStatuses: boolean;
  canManageLabels: boolean;
  canCreateTasks: boolean;
  canManageTasks: boolean;
}

export interface GroupMemberPreview {
  userId: string;
  name: string;
  avatar: string | null;
}

/** Group item trong danh sách GET /groups */
export interface GroupListItem {
  _id: string;
  name: string;
  description: string | null;
  startDate: string | null;
  endDate: string | null;
  ownerId: string;
  role: GroupRole;
  memberCount: number;
  memberPreview: GroupMemberPreview[];
  completionRate: number;
  createdAt: string;
}

/** Member trong group detail */
export interface GroupMember {
  userId: string;
  name: string;
  email: string;
  avatar: string | null;
  role: GroupRole;
  joinedAt: string;
}

/** Invite đang gắn với group detail. */
export interface GroupInvite {
  _id: string;
  email: string;
  role: GroupRole;
  status: InviteStatus;
  invitedAt: string;
  expiresAt: string;
  userId: string | null;
  name: string | null;
  avatar: string | null;
}

/** Group chi tiết GET /groups/:groupId */
export interface GroupDetail {
  _id: string;
  name: string;
  description: string | null;
  startDate: string | null;
  endDate: string | null;
  ownerId: string;
  viewerRole: GroupRole;
  memberCount: number;
  pendingInviteCount: number;
  permissions: GroupPermissions;
  members: GroupMember[];
  invites: GroupInvite[];
  createdAt: string;
}

export interface InviteSummary {
  requested: number;
  sent: number;
  failedEmails: string[];
}

export interface GroupCreateResponse {
  _id: string;
  name: string;
  description: string | null;
  startDate: string | null;
  endDate: string | null;
  ownerId: string;
  createdAt: string;
  inviteSummary: InviteSummary;
}

export interface GroupUpdateResponse {
  _id: string;
  name: string;
  description: string | null;
  startDate: string | null;
  endDate: string | null;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
  inviteSummary: InviteSummary;
}

// ──── Invite ────

/** Response khi accept invite thành công */
export interface InviteAcceptResponse {
  groupId: string;
  groupName: string;
}

// ──── Status ────

/** Status metadata — columns trên Kanban board */
export interface TaskStatus {
  _id: string;
  name: string;
  slug: string;
  color: string;
  order: number;
  isDefault: boolean;
  isCompleted: boolean;
}

export interface StatusPreset {
  key: string;
  name: string;
  slug: string;
  color: string;
  isCompleted: boolean;
  usageCount: number;
}

// ──── Label ────

export interface TaskLabel {
  _id: string;
  name: string;
  color: string;
}

export interface LabelPreset {
  key: string;
  name: string;
  color: string;
  usageCount: number;
}

export interface MemberCandidate {
  userId: string;
  name: string;
  email: string;
  avatar: string | null;
}

// ──── Task ────

/** Assignee/Creator compact (populated trong task response) */
export interface TaskUser {
  _id: string;
  name: string;
  avatar?: string | null;
}

export interface TaskAttachment {
  _id: string;
  originalName: string;
  storedName: string;
  mimeType: string;
  size: number;
  uploadedBy: TaskUser;
  createdAt: string;
}

export type TaskCommentAuthor = TaskUser;

export interface TaskComment {
  _id: string;
  content: string;
  author: TaskCommentAuthor;
  createdAt: string;
  updatedAt: string;
  isEdited: boolean;
}

/** Label compact (populated trong task response) */
export interface TaskLabelCompact {
  _id: string;
  name: string;
  color: string;
}

/** Status compact (populated trong task response) */
export interface TaskStatusCompact {
  _id: string;
  name: string;
  color: string;
}

/** Task item — dùng trong list/board view */
export interface TaskItem {
  _id: string;
  title: string;
  description: string | null;
  assignee: TaskUser | null;
  deadline: string | null;
  labels: TaskLabelCompact[];
  createdAt: string;
}

/** Task chi tiết — GET /groups/:groupId/tasks/:taskId */
export interface TaskDetail extends TaskItem {
  groupId: string;
  status: TaskStatusCompact;
  creator: TaskUser;
  attachments: TaskAttachment[];
  commentCount: number;
  reminderSentAt: string | null;
  overdueSentAt: string | null;
  updatedAt: string;
}

export interface MyTaskGroupSummary {
  groupId: string;
  name: string;
  role: GroupRole;
  memberCount: number;
}

export interface MyTaskStatusFilterOption {
  groupId: string;
  groupName: string;
  statusId: string;
  name: string;
  color: string;
  isCompleted: boolean;
}

export interface MyTaskLabelFilterOption {
  groupId: string;
  groupName: string;
  labelId: string;
  name: string;
  color: string;
}

export interface MyTaskItem {
  taskId: string;
  groupId: string;
  title: string;
  deadline: string | null;
  createdAt: string;
  updatedAt: string;
  status: {
    statusId: string;
    name: string;
    color: string;
    isCompleted: boolean;
  };
  labels: TaskLabelCompact[];
}

export interface MyTaskGroupSection {
  group: MyTaskGroupSummary;
  tasks: MyTaskItem[];
  total: number;
}

export interface MyTaskListResponse {
  groups: MyTaskGroupSection[];
  filterOptions: {
    groups: MyTaskGroupSummary[];
    statuses: MyTaskStatusFilterOption[];
    labels: MyTaskLabelFilterOption[];
  };
  totals: {
    taskCount: number;
    groupCount: number;
  };
}

/** Kanban board column — status + tasks */
export interface BoardColumn {
  _id: string;
  name: string;
  slug: string;
  color: string;
  order: number;
  isCompleted: boolean;
  tasks: TaskItem[];
}

/** Board data — GET /groups/:groupId/tasks */
export interface BoardData {
  statuses: BoardColumn[];
}

export interface TaskListItem extends TaskItem {
  statusId: string;
  statusName: string;
  statusColor: string;
  statusIsCompleted: boolean;
}

export interface TaskListResponse {
  tasks: TaskListItem[];
}

// ──── Dashboard ────

export interface StatusBreakdownItem {
  statusId: string;
  name: string;
  color: string;
  isCompleted: boolean;
  count: number;
}

export interface TasksByAssigneeItem {
  userId: string;
  name: string;
  avatar: string | null;
  total: number;
  done: number;
}

export interface DashboardTaskUser {
  userId: string;
  name: string;
  avatar: string | null;
}

export interface DashboardTaskStatus {
  statusId: string;
  name: string;
  color: string;
  isCompleted: boolean;
}

export interface TaskOverviewItem {
  taskId: string;
  title: string;
  createdAt: string;
  deadline: string | null;
  assignee: DashboardTaskUser | null;
  status: DashboardTaskStatus;
}

export interface TaskAttentionItem extends TaskOverviewItem {
  kind: 'overdue' | 'upcoming';
}

export interface DashboardData {
  totalTasks: number;
  completedTasks: number;
  statusBreakdown: StatusBreakdownItem[];
  overdueCount: number;
  completionRate: number;
  tasksByAssignee: TasksByAssigneeItem[];
  recentTasks: TaskOverviewItem[];
  attentionTasks: TaskAttentionItem[];
}

export interface MyDashboardTaskGroup {
  groupId: string;
  name: string;
  role: GroupRole;
}

export interface MyDashboardTaskStatus {
  statusId: string;
  name: string;
  color: string;
  isCompleted: boolean;
}

export interface MyDashboardTaskItem {
  taskId: string;
  title: string;
  deadline: string | null;
  updatedAt: string;
  group: MyDashboardTaskGroup;
  status: MyDashboardTaskStatus;
}

export interface MyDashboardAttentionTaskItem extends MyDashboardTaskItem {
  kind: 'overdue' | 'due-today';
}

export interface MyDashboardSummary {
  assignedTasks: number;
  openTasks: number;
  completedTasks: number;
  dueTodayCount: number;
  overdueCount: number;
  groupCount: number;
}

export interface MyDashboardGroupItem {
  groupId: string;
  name: string;
  role: GroupRole;
  assignedTasks: number;
  openTasks: number;
  completedTasks: number;
  dueTodayCount: number;
  overdueCount: number;
  completionRate: number;
  nextDeadline: string | null;
}

export interface MyDashboardData {
  summary: MyDashboardSummary;
  attentionTasks: MyDashboardAttentionTaskItem[];
  recentTasks: MyDashboardTaskItem[];
  groups: MyDashboardGroupItem[];
}
