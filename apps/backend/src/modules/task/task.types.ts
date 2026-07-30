/**
 * Các interface này đại diện cho dữ liệu đã được serialize thành JSON response.
 * ID fields dùng `string` (không phải Types.ObjectId) — đã chuyển đổi trước khi trả ra client.
 */

/** Tham chiếu status thu gọn — nhúng trong task response. */
export interface StatusRef {
  _id: string;
  name: string;
  color: string;
}

/** Tham chiếu người được giao việc — nhúng trong task response. */
export interface AssigneeRef {
  _id: string;
  name: string;
  avatar: string | null;
}

/** Tham chiếu người tạo task — nhúng trong task detail response. */
export interface CreatorRef {
  _id: string;
  name: string;
}

export interface AttachmentUploaderRef {
  _id: string;
  name: string;
  avatar: string | null;
}

export interface CommentAuthorRef {
  _id: string;
  name: string;
  avatar: string | null;
}

/** Tham chiếu label thu gọn — nhúng trong task response. */
export interface LabelRef {
  _id: string;
  name: string;
  color: string;
}

/**
 * Kết quả trả về sau khi tạo task thành công.
 * Khớp với response shape §4.1 trong API spec.
 */
export interface CreateTaskResult {
  _id: string;
  title: string;
  description: string | null;
  groupId: string;
  statusId: string;
  status: StatusRef;
  assigneeId: string | null;
  assignee: AssigneeRef | null;
  creatorId: string;
  deadline: Date | null;
  labels: LabelRef[];
  createdAt: Date;
}

export interface TaskAttachmentResult {
  _id: string;
  originalName: string;
  storedName: string;
  mimeType: string;
  size: number;
  uploadedBy: AttachmentUploaderRef;
  createdAt: Date;
}

export interface TaskCommentResult {
  _id: string;
  content: string;
  author: CommentAuthorRef;
  createdAt: Date;
  updatedAt: Date;
  isEdited: boolean;
}

/**
 * Kết quả trả về khi lấy chi tiết task.
 * Khớp với response shape §4.5 trong API spec.
 * Bao gồm cả reminderSentAt / overdueSentAt — dùng cho cron job và admin view.
 */
export interface TaskDetailResult {
  _id: string;
  title: string;
  description: string | null;
  groupId: string;
  status: StatusRef;
  assignee: AssigneeRef | null;
  creator: CreatorRef;
  deadline: Date | null;
  labels: LabelRef[];
  attachments: TaskAttachmentResult[];
  commentCount: number;
  reminderSentAt: Date | null;
  overdueSentAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Task card hiển thị trong một cột Kanban.
 * Khớp với item shape trong response §4.2 của API spec.
 * Không bao gồm creator và notification flags — đây là list view, không phải detail.
 */
export interface KanbanTaskItem {
  _id: string;
  title: string;
  description: string | null;
  assignee: AssigneeRef | null;
  deadline: Date | null;
  labels: LabelRef[];
  createdAt: Date;
}

/**
 * Một cột Kanban — status kèm danh sách tasks thuộc nó.
 * Empty statuses vẫn được trả về (tasks = []) để frontend render stable board layout.
 */
export interface KanbanStatusColumn {
  _id: string;
  name: string;
  slug: string;
  color: string;
  order: number;
  isCompleted: boolean;
  tasks: KanbanTaskItem[];
}

/**
 * Toàn bộ dữ liệu Kanban board của một group.
 * Khớp với response shape §4.2 của API spec.
 */
export interface KanbanResult {
  statuses: KanbanStatusColumn[];
}

export interface TaskListItemResult {
  _id: string;
  title: string;
  description: string | null;
  assignee: AssigneeRef | null;
  deadline: Date | null;
  labels: LabelRef[];
  createdAt: Date;
  statusId: string;
  statusName: string;
  statusColor: string;
  statusIsCompleted: boolean;
}

export interface TaskListResult {
  tasks: TaskListItemResult[];
}

export interface MyTaskGroupSummaryResult {
  groupId: string;
  name: string;
  role: string;
  memberCount: number;
}

export interface MyTaskFilterGroupOptionResult {
  groupId: string;
  name: string;
  role: string;
  memberCount: number;
}

export interface MyTaskStatusFilterOptionResult {
  groupId: string;
  groupName: string;
  statusId: string;
  name: string;
  color: string;
  isCompleted: boolean;
}

export interface MyTaskLabelFilterOptionResult {
  groupId: string;
  groupName: string;
  labelId: string;
  name: string;
  color: string;
}

export interface MyTaskItemResult {
  taskId: string;
  groupId: string;
  title: string;
  deadline: Date | null;
  createdAt: Date;
  updatedAt: Date;
  status: {
    statusId: string;
    name: string;
    color: string;
    isCompleted: boolean;
  };
  labels: LabelRef[];
}

export interface MyTaskGroupSectionResult {
  group: MyTaskGroupSummaryResult;
  tasks: MyTaskItemResult[];
  total: number;
}

export interface MyTaskFilterOptionsResult {
  groups: MyTaskFilterGroupOptionResult[];
  statuses: MyTaskStatusFilterOptionResult[];
  labels: MyTaskLabelFilterOptionResult[];
}

export interface MyTaskListResult {
  groups: MyTaskGroupSectionResult[];
  filterOptions: MyTaskFilterOptionsResult;
  totals: {
    taskCount: number;
    groupCount: number;
  };
}
