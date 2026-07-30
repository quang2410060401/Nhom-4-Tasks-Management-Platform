import { GroupRole } from './enums/group-role.enum';
import { InviteStatus } from './enums/invite-status.enum';

/**
 * Các interface này đại diện cho dữ liệu đã được serialize thành JSON response.
 * ID fields dùng `string` (không phải Types.ObjectId) vì đây là dữ liệu sau khi
 * Mongoose đã chuyển ObjectId thành string khi trả về client.
 */

/** Kết quả trả về sau khi tạo nhóm thành công. */
export interface InviteSummaryResult {
  requested: number;
  sent: number;
  failedEmails: string[];
}

export interface GroupPermissionsResult {
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

/** Kết quả trả về sau khi tạo nhóm thành công. */
export interface CreateGroupResult {
  _id: string;
  name: string;
  description: string | null;
  startDate: Date | null;
  endDate: Date | null;
  ownerId: string;
  createdAt: Date;
  inviteSummary: InviteSummaryResult;
}

/** Thông tin thành viên kèm trong chi tiết nhóm. */
export interface GroupMemberInfo {
  userId: string;
  name: string;
  email: string;
  avatar: string | null;
  role: GroupRole;
  joinedAt: Date;
}

/** Preview member cho group list/card. */
export interface GroupMemberPreviewInfo {
  userId: string;
  name: string;
  avatar: string | null;
}

/** Lời mời đang chờ xử lý, dùng để hiển thị pending invite trong chi tiết nhóm. */
export interface GroupInviteInfo {
  _id: string;
  email: string;
  role: GroupRole;
  status: InviteStatus;
  invitedAt: Date;
  expiresAt: Date;
  userId: string | null;
  name: string | null;
  avatar: string | null;
}

/** Kết quả trả về danh sách nhóm của user. */
export interface GroupListItem {
  _id: string;
  name: string;
  description: string | null;
  startDate: Date | null;
  endDate: Date | null;
  ownerId: string;
  role: GroupRole;
  memberCount: number;
  memberPreview: GroupMemberPreviewInfo[];
  /** Phần trăm hoàn thành công việc của nhóm, làm tròn 1 chữ số thập phân. */
  completionRate: number;
  createdAt: Date;
}

/** Kết quả chi tiết nhóm bao gồm danh sách thành viên. */
export interface GroupDetailResult {
  _id: string;
  name: string;
  description: string | null;
  startDate: Date | null;
  endDate: Date | null;
  ownerId: string;
  viewerRole: GroupRole;
  memberCount: number;
  pendingInviteCount: number;
  permissions: GroupPermissionsResult;
  members: GroupMemberInfo[];
  invites: GroupInviteInfo[];
  createdAt: Date;
}

/** Kết quả sau khi cập nhật thông tin cơ bản của nhóm. */
export interface UpdateGroupResult {
  _id: string;
  name: string;
  description: string | null;
  startDate: Date | null;
  endDate: Date | null;
  ownerId: string;
  createdAt: Date;
  updatedAt: Date;
  inviteSummary: InviteSummaryResult;
}

/** Kết quả sau khi chấp nhận lời mời vào nhóm. */
export interface AcceptInviteResult {
  groupId: string;
  groupName: string;
}

/** Kết quả Status sau khi tạo/cập nhật — không trả raw Document. */
export interface StatusResult {
  _id: string;
  groupId: string;
  name: string;
  slug: string;
  color: string;
  order: number;
  isDefault: boolean;
  isCompleted: boolean;
}

/** Kết quả Label sau khi tạo/cập nhật — không trả raw Document. */
export interface LabelResult {
  _id: string;
  groupId: string;
  name: string;
  color: string;
}

/** Preset status tổng hợp từ các workflow đã tồn tại trong hệ thống. */
export interface StatusPresetResult {
  key: string;
  name: string;
  slug: string;
  color: string;
  isCompleted: boolean;
  usageCount: number;
}

/** Preset label tổng hợp từ các nhóm khác trong hệ thống. */
export interface LabelPresetResult {
  key: string;
  name: string;
  color: string;
  usageCount: number;
}

/** User candidate dùng cho autocomplete thành viên khi tạo/sửa group. */
export interface MemberCandidateResult {
  userId: string;
  name: string;
  email: string;
  avatar: string | null;
}

/** Một dòng trong statusBreakdown của dashboard — số tasks theo từng status. */
export interface StatusBreakdownItem {
  statusId: string;
  name: string;
  color: string;
  isCompleted: boolean;
  count: number;
}

/** Thống kê tasks của một thành viên trong dashboard. */
export interface AssigneeStatItem {
  userId: string;
  name: string;
  avatar: string | null;
  /** Tổng số tasks được giao cho thành viên này trong nhóm. */
  total: number;
  /** Số tasks đã hoàn thành (status.isCompleted = true). */
  done: number;
}

export interface TaskOverviewUserResult {
  userId: string;
  name: string;
  avatar: string | null;
}

export interface TaskOverviewStatusResult {
  statusId: string;
  name: string;
  color: string;
  isCompleted: boolean;
}

export interface TaskOverviewItemResult {
  taskId: string;
  title: string;
  createdAt: Date;
  deadline: Date | null;
  assignee: TaskOverviewUserResult | null;
  status: TaskOverviewStatusResult;
}

export interface TaskAttentionItemResult extends TaskOverviewItemResult {
  kind: 'overdue' | 'upcoming';
}

/** Kết quả endpoint GET /groups/:groupId/dashboard. */
export interface DashboardResult {
  totalTasks: number;
  completedTasks: number;
  statusBreakdown: StatusBreakdownItem[];
  overdueCount: number;
  /** Phần trăm hoàn thành, làm tròn 1 chữ số thập phân. 0.0 khi chưa có tasks. */
  completionRate: number;
  tasksByAssignee: AssigneeStatItem[];
  recentTasks: TaskOverviewItemResult[];
  attentionTasks: TaskAttentionItemResult[];
}
