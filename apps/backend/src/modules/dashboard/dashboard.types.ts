/**
 * Các interface này đại diện cho dữ liệu dashboard đã được serialize thành JSON response.
 * ID fields dùng `string` (không phải Types.ObjectId) — đã chuyển đổi trước khi trả ra client.
 */

/** Thống kê số lượng task thuộc một status cụ thể. */
export interface StatusBreakdownItem {
  /** ObjectId của status — string representation. */
  statusId: string;
  /** Tên hiển thị của status, ví dụ: "Todo", "Doing", "Done". */
  name: string;
  /** Màu hex của status, ví dụ: "#3B82F6". */
  color: string;
  /** Trạng thái này có phải cột completed không. */
  isCompleted: boolean;
  /** Tổng số tasks đang ở status này. */
  count: number;
}

/** Thống kê số lượng task theo từng thành viên của group. */
export interface TasksByAssigneeItem {
  /** ObjectId của user — string representation. */
  userId: string;
  /** Tên hiển thị của thành viên. */
  name: string;
  /** URL avatar hoặc null nếu chưa đặt avatar. */
  avatar: string | null;
  /** Tổng số tasks được assign cho thành viên này. */
  total: number;
  /** Số tasks đã hoàn thành (status.isCompleted = true). */
  done: number;
}

export interface TaskOverviewUser {
  userId: string;
  name: string;
  avatar: string | null;
}

export interface TaskOverviewStatus {
  statusId: string;
  name: string;
  color: string;
  isCompleted: boolean;
}

export interface TaskOverviewItem {
  taskId: string;
  title: string;
  createdAt: Date;
  deadline: Date | null;
  assignee: TaskOverviewUser | null;
  status: TaskOverviewStatus;
}

export interface TaskAttentionItem extends TaskOverviewItem {
  kind: 'overdue' | 'upcoming';
}

export interface MyDashboardTaskGroup {
  groupId: string;
  name: string;
  role: string;
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
  deadline: Date | null;
  updatedAt: Date;
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
  role: string;
  assignedTasks: number;
  openTasks: number;
  completedTasks: number;
  dueTodayCount: number;
  overdueCount: number;
  completionRate: number;
  nextDeadline: Date | null;
}

export interface MyDashboardData {
  summary: MyDashboardSummary;
  attentionTasks: MyDashboardAttentionTaskItem[];
  recentTasks: MyDashboardTaskItem[];
  groups: MyDashboardGroupItem[];
}

/** Toàn bộ dữ liệu dashboard của một group. */
export interface DashboardData {
  /** Tổng số tasks trong group. */
  totalTasks: number;
  /** Tổng số tasks ở các cột status có isCompleted = true. */
  completedTasks: number;
  /** Phân bổ tasks theo từng status của group (dynamic, không hardcode). */
  statusBreakdown: StatusBreakdownItem[];
  /**
   * Số tasks quá hạn: deadline < now AND status.isCompleted = false.
   * Tasks chưa có deadline không được tính vào overdueCount.
   */
  overdueCount: number;
  /**
   * Tỷ lệ hoàn thành tính theo phần trăm, làm tròn 1 chữ số thập phân.
   * Công thức: (completed_count / totalTasks) * 100
   * completed_count = tổng tasks có status.isCompleted = true.
   * Trả về 0 nếu totalTasks = 0 (tránh chia cho 0).
   */
  completionRate: number;
  /** Thống kê tasks theo từng thành viên trong group. */
  tasksByAssignee: TasksByAssigneeItem[];
  /** Tối đa 5 công việc mới nhất theo createdAt desc. */
  recentTasks: TaskOverviewItem[];
  /** Tối đa 5 công việc cần chú ý: overdue trước, upcoming trong 7 ngày tiếp theo. */
  attentionTasks: TaskAttentionItem[];
}
