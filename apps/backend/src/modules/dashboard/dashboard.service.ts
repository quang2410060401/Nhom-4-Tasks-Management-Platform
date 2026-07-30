import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  isObjectIdValid,
  toObjectId,
} from '../../common/utils/object-id.util';
import { Task, TaskDocument } from '../task/schemas/task.schema';
import { Status, StatusDocument } from '../group/schemas/status.schema';
import { User, UserDocument } from '../auth/schemas/user.schema';
import { Group, GroupDocument } from '../group/schemas/group.schema';
import {
  GroupMember,
  GroupMemberDocument,
} from '../group/schemas/group-member.schema';
import { GroupRole } from '../group/enums/group-role.enum';
import {
  DashboardData,
  MyDashboardAttentionTaskItem,
  MyDashboardData,
  MyDashboardGroupItem,
  MyDashboardTaskItem,
  StatusBreakdownItem,
  TaskAttentionItem,
  TaskOverviewItem,
  TasksByAssigneeItem,
} from './dashboard.types';

/** Shape trả về từ MongoDB aggregate pipeline đếm tasks theo statusId. */
interface TaskCountByStatus {
  _id: Types.ObjectId;
  count: number;
}

/**
 * Shape trả về từ pipeline thống kê tasks theo assigneeId.
 * _id = assigneeId (ObjectId hoặc null khi task chưa được assign).
 */
interface TaskCountByAssignee {
  _id: Types.ObjectId | null;
  total: number;
  done: number;
}

interface TaskPreviewDocument {
  _id: Types.ObjectId;
  title: string;
  createdAt: Date;
  deadline: Date | null;
  assigneeId: Types.ObjectId | null;
  statusId: Types.ObjectId;
}

interface AssignedTaskPreviewDocument {
  _id: Types.ObjectId;
  title: string;
  groupId: Types.ObjectId;
  statusId: Types.ObjectId;
  deadline: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(
    @InjectModel(Task.name)
    private readonly taskModel: Model<TaskDocument>,
    @InjectModel(Status.name)
    private readonly statusModel: Model<StatusDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    @InjectModel(Group.name)
    private readonly groupModel: Model<GroupDocument>,
    @InjectModel(GroupMember.name)
    private readonly groupMemberModel: Model<GroupMemberDocument>,
  ) {}

  /**
   * Lấy toàn bộ dữ liệu dashboard của một group.
   *
   * Chiến lược query:
   *   Phase 1 — 5 truy vấn song song cho KPI nền:
   *   Q1 — countDocuments({ groupId })                           → totalTasks
   *   Q2 — aggregate $group by statusId trên tasks collection   → taskCountByStatus[]
   *   Q3 — find statuses của group (lấy name, color, isCompleted)
   *   Q4 — countDocuments quá hạn: deadline < now + statusId KHÔNG isCompleted
   *   Q5 — aggregate tasks theo assigneeId                      → tasksByAssigneeRaw[]
   *
   * Sau khi có Q2 + Q3:
   *   - Join in-memory để build statusBreakdown (có name/color/count mỗi cột).
   *   - Tính completionRate từ statusBreakdown + trạng thái isCompleted.
   *   - Xác định tập status chưa hoàn thành để phục vụ attentionTasks.
   *
   *   Phase 2 — 2 query presentation data:
   *   Q6 — recentTasks: top 5 theo createdAt desc
   *   Q7 — attentionTasks: top 5 overdue trước, rồi upcoming đến hết hôm nay
   *
   * overdueCount: dùng $lookup pipeline (1 query) thay vì 2 query riêng
   *   để tránh N+1 khi cần lọc theo status.isCompleted trong tasks collection.
   *
   * @param groupId - ObjectId string của group cần lấy dashboard
   */
  async getDashboard(groupId: string): Promise<DashboardData> {
    this.logger.log(`Fetching dashboard for group: ${groupId}`);

    const groupObjectId = toObjectId(groupId);
    const now = new Date();
    const upcomingCutoff = new Date(now);
    upcomingCutoff.setHours(23, 59, 59, 999);

    // -------------------------------------------------------------------------
    // Chạy cả 5 query độc lập song song để tối ưu latency.
    // Q4 và Q5 không phụ thuộc vào kết quả Q1/Q2/Q3 nên có thể chạy cùng lúc.
    // -------------------------------------------------------------------------
    const [
      totalTasks,
      taskCountByStatus,
      groupStatuses,
      overdueAgg,
      tasksByAssigneeRaw,
    ] = await Promise.all([
      // Q1: Đếm tổng số tasks trong group
      this.taskModel.countDocuments({ groupId: groupObjectId }).exec(),

      // Q2: Đếm số tasks theo từng statusId
      // Kết quả: [{ _id: ObjectId(statusId), count: N }, ...]
      this.taskModel.aggregate<TaskCountByStatus>([
        { $match: { groupId: groupObjectId } },
        { $group: { _id: '$statusId', count: { $sum: 1 } } },
      ]),

      // Q3: Lấy tất cả statuses của group để tra cứu name, color, isCompleted
      this.statusModel
        .find({ groupId: groupObjectId })
        .select('name color isCompleted order')
        .lean()
        .exec(),

      // Q4: Đếm tasks quá hạn
      // overdueCount = tasks có deadline < now AND status.isCompleted = false
      // Dùng $lookup pipeline (1 round-trip) thay vì 2 query riêng.
      this.taskModel.aggregate<{ count: number }>([
        {
          $match: {
            groupId: groupObjectId,
            deadline: { $lt: now, $ne: null },
          },
        },
        {
          $lookup: {
            from: 'statuses',
            localField: 'statusId',
            foreignField: '_id',
            as: 'status',
          },
        },
        // $lookup trả về mảng — lấy phần tử đầu tiên
        { $unwind: '$status' },
        // Chỉ giữ lại tasks ở status chưa hoàn thành
        { $match: { 'status.isCompleted': false } },
        { $count: 'count' },
      ]),

      // Q5: Thống kê tasks theo assigneeId
      //   - Lọc tasks có assigneeId (bỏ qua unassigned — spec chỉ yêu cầu per-member)
      //   - $lookup join statuses để lấy isCompleted (không hardcode tên status)
      //   - $group đếm total và done theo từng assigneeId
      this.taskModel.aggregate<TaskCountByAssignee>([
        {
          $match: {
            groupId: groupObjectId,
            assigneeId: { $ne: null },
          },
        },
        {
          $lookup: {
            from: 'statuses',
            localField: 'statusId',
            foreignField: '_id',
            as: 'status',
          },
        },
        { $unwind: '$status' },
        {
          $group: {
            _id: '$assigneeId',
            total: { $sum: 1 },
            // Đếm done: cộng 1 nếu status.isCompleted = true, cộng 0 nếu false
            done: { $sum: { $cond: ['$status.isCompleted', 1, 0] } },
          },
        },
      ]),
    ]);

    const overdueCount = overdueAgg[0]?.count ?? 0;

    // -------------------------------------------------------------------------
    // Build map statusId → StatusDocument để join in-memory (O(n))
    // -------------------------------------------------------------------------
    const statusMap = new Map(groupStatuses.map((s) => [s._id.toString(), s]));

    // -------------------------------------------------------------------------
    // Build statusBreakdown: ghép count vào từng status của group.
    // Các status không có task vẫn xuất hiện với count = 0 (UX requirement).
    // Sắp xếp theo order của status để giữ thứ tự cột Kanban.
    // -------------------------------------------------------------------------
    const countMap = new Map(
      taskCountByStatus.map((r) => [r._id.toString(), r.count]),
    );

    // Dùng spread [...] trước sort để tránh mutate mảng gốc groupStatuses
    const statusBreakdown: StatusBreakdownItem[] = [...groupStatuses]
      .sort((a, b) => a.order - b.order)
      .map((s) => ({
        statusId: s._id.toString(),
        name: s.name,
        color: s.color,
        isCompleted: s.isCompleted,
        count: countMap.get(s._id.toString()) ?? 0,
      }));

    // -------------------------------------------------------------------------
    // Tính completionRate
    // completedCount = tổng tasks ở các status có isCompleted = true
    // Tránh chia cho 0 khi group chưa có task nào.
    // -------------------------------------------------------------------------
    let completedCount = 0;
    for (const r of taskCountByStatus) {
      const status = statusMap.get(r._id.toString());
      if (status?.isCompleted) {
        completedCount += r.count;
      }
    }

    const completionRate =
      totalTasks > 0
        ? Math.round((completedCount / totalTasks) * 1000) / 10
        : 0;

    const incompleteStatusIds = groupStatuses
      .filter((status) => !status.isCompleted)
      .map((status) => status._id);

    const [recentTasksRaw, attentionTasksRaw] = await Promise.all([
      this.taskModel
        .find({ groupId: groupObjectId })
        .select('title createdAt deadline assigneeId statusId')
        .sort({ createdAt: -1 })
        .limit(5)
        .lean()
        .exec() as unknown as Promise<TaskPreviewDocument[]>,
      incompleteStatusIds.length > 0
        ? (this.taskModel
            .find({
              groupId: groupObjectId,
              statusId: { $in: incompleteStatusIds },
              deadline: { $ne: null, $lte: upcomingCutoff },
            })
            .select('title createdAt deadline assigneeId statusId')
            .sort({ deadline: 1 })
            .limit(5)
            .lean()
            .exec() as unknown as Promise<TaskPreviewDocument[]>)
        : Promise.resolve([]),
    ]);

    // -------------------------------------------------------------------------
    // Resolve thông tin assignee (name, avatar) trong 1 batch query — tránh N+1.
    // Dùng $in trên danh sách assigneeId thu thập từ Q5.
    // -------------------------------------------------------------------------
    const assigneeIds = new Map<string, Types.ObjectId>();

    for (const item of tasksByAssigneeRaw) {
      if (item._id) {
        assigneeIds.set(item._id.toString(), item._id);
      }
    }

    for (const task of [...recentTasksRaw, ...attentionTasksRaw]) {
      if (task.assigneeId) {
        assigneeIds.set(task.assigneeId.toString(), task.assigneeId);
      }
    }

    const assigneeUsers = await this.userModel
      .find({ _id: { $in: [...assigneeIds.values()] } })
      .select('name avatar')
      .lean()
      .exec();

    // Map userId → { name, avatar } để join in-memory
    const userMap = new Map(assigneeUsers.map((u) => [u._id.toString(), u]));

    // Ghép kết quả aggregate với thông tin user, bỏ qua các assigneeId không tìm thấy
    const tasksByAssignee: TasksByAssigneeItem[] = tasksByAssigneeRaw
      .filter((r) => r._id !== null && userMap.has(r._id.toString()))
      .map((r) => {
        const user = userMap.get(r._id!.toString())!;
        return {
          userId: r._id!.toString(),
          name: user.name,
          avatar: user.avatar ?? null,
          total: r.total,
          done: r.done,
        };
      });

    const toTaskOverviewItem = (
      task: TaskPreviewDocument,
    ): TaskOverviewItem | null => {
      const status = statusMap.get(task.statusId.toString());
      if (!status) {
        return null;
      }

      const assignee = task.assigneeId
        ? userMap.get(task.assigneeId.toString())
        : null;

      return {
        taskId: task._id.toString(),
        title: task.title,
        createdAt: task.createdAt,
        deadline: task.deadline ?? null,
        assignee: task.assigneeId
          ? {
              userId: task.assigneeId.toString(),
              name: assignee?.name ?? 'Thành viên không xác định',
              avatar: assignee?.avatar ?? null,
            }
          : null,
        status: {
          statusId: status._id.toString(),
          name: status.name,
          color: status.color,
          isCompleted: status.isCompleted,
        },
      };
    };

    const recentTasks = recentTasksRaw
      .map((task) => toTaskOverviewItem(task))
      .filter((task): task is TaskOverviewItem => task !== null);

    const attentionTasks = attentionTasksRaw
      .map((task) => {
        const overviewItem = toTaskOverviewItem(task);
        if (!overviewItem || !task.deadline) {
          return null;
        }

        const kind: TaskAttentionItem['kind'] =
          task.deadline.getTime() < now.getTime() ? 'overdue' : 'upcoming';

        return {
          ...overviewItem,
          kind,
        };
      })
      .filter((task): task is TaskAttentionItem => task !== null);

    this.logger.log(
      `Dashboard fetched — group: ${groupId}, total: ${totalTasks}, ` +
        `overdue: ${overdueCount}, completion: ${completionRate}%, ` +
        `assignees: ${tasksByAssignee.length}, recent: ${recentTasks.length}, ` +
        `attention: ${attentionTasks.length}`,
    );

    return {
      totalTasks,
      completedTasks: completedCount,
      statusBreakdown,
      overdueCount,
      completionRate,
      tasksByAssignee,
      recentTasks,
      attentionTasks,
    };
  }

  async getMyDashboard(userId: string): Promise<MyDashboardData> {
    if (!isObjectIdValid(userId)) {
      return this._buildEmptyMyDashboard();
    }

    const userObjectId = toObjectId(userId);
    const memberships = await this.groupMemberModel
      .find({ userId: userObjectId })
      .select({ groupId: 1, role: 1 })
      .lean()
      .exec();

    if (memberships.length === 0) {
      return this._buildEmptyMyDashboard();
    }

    const membershipRoleMap = new Map(
      memberships.map((membership) => [
        membership.groupId.toString(),
        membership.role,
      ]),
    );
    const memberGroupIds = memberships.map((membership) => membership.groupId);

    const assignedTasks = (await this.taskModel
      .find({
        assigneeId: userObjectId,
        groupId: { $in: memberGroupIds },
      })
      .select({
        title: 1,
        groupId: 1,
        statusId: 1,
        deadline: 1,
        createdAt: 1,
        updatedAt: 1,
      })
      .lean()
      .exec()) as unknown as AssignedTaskPreviewDocument[];

    if (assignedTasks.length === 0) {
      return this._buildEmptyMyDashboard();
    }

    const groupIds = Array.from(
      new Set(assignedTasks.map((task) => task.groupId.toString())),
    ).map((id) => toObjectId(id));
    const statusIds = Array.from(
      new Set(assignedTasks.map((task) => task.statusId.toString())),
    ).map((id) => toObjectId(id));

    const [groups, statuses] = await Promise.all([
      this.groupModel
        .find({ _id: { $in: groupIds } })
        .select({ name: 1 })
        .lean()
        .exec(),
      this.statusModel
        .find({ _id: { $in: statusIds } })
        .select({ name: 1, color: 1, isCompleted: 1 })
        .lean()
        .exec(),
    ]);

    const groupMap = new Map(
      groups.map((group) => [group._id.toString(), group]),
    );
    const statusMap = new Map(
      statuses.map((status) => [status._id.toString(), status]),
    );

    const now = new Date();
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date(now);
    endOfToday.setHours(23, 59, 59, 999);

    const normalizedTasks = assignedTasks
      .map((task) => {
        const group = groupMap.get(task.groupId.toString());
        const status = statusMap.get(task.statusId.toString());
        if (!group || !status) {
          return null;
        }

        const role =
          membershipRoleMap.get(task.groupId.toString()) ?? GroupRole.MEMBER;
        const previewTask: MyDashboardTaskItem = {
          taskId: task._id.toString(),
          title: task.title,
          deadline: task.deadline ?? null,
          updatedAt: task.updatedAt,
          group: {
            groupId: task.groupId.toString(),
            name: group.name,
            role,
          },
          status: {
            statusId: status._id.toString(),
            name: status.name,
            color: status.color,
            isCompleted: status.isCompleted,
          },
        };

        return {
          previewTask,
          createdAt: task.createdAt,
          updatedAt: task.updatedAt,
        };
      })
      .filter(
        (
          task,
        ): task is {
          previewTask: MyDashboardTaskItem;
          createdAt: Date;
          updatedAt: Date;
        } => task !== null,
      );

    const groupedTasks = new Map<string, typeof normalizedTasks>();
    for (const task of normalizedTasks) {
      const groupId = task.previewTask.group.groupId;
      if (!groupedTasks.has(groupId)) {
        groupedTasks.set(groupId, []);
      }
      groupedTasks.get(groupId)!.push(task);
    }

    const openTasks = normalizedTasks.filter(
      (task) => !task.previewTask.status.isCompleted,
    );
    const completedTasks = normalizedTasks.filter(
      (task) => task.previewTask.status.isCompleted,
    );
    const overdueTasks = openTasks.filter(
      (task) =>
        task.previewTask.deadline &&
        task.previewTask.deadline.getTime() < now.getTime(),
    );
    const dueTodayTasks = openTasks.filter(
      (task) =>
        task.previewTask.deadline &&
        task.previewTask.deadline.getTime() >= now.getTime() &&
        this._isWithinToday(
          task.previewTask.deadline,
          startOfToday,
          endOfToday,
        ),
    );

    const attentionTasks: MyDashboardAttentionTaskItem[] = [...openTasks]
      .filter(
        (task) =>
          task.previewTask.deadline &&
          (task.previewTask.deadline.getTime() < now.getTime() ||
            this._isWithinToday(
              task.previewTask.deadline,
              startOfToday,
              endOfToday,
            )),
      )
      .sort((left, right) => {
        const leftOverdue =
          left.previewTask.deadline &&
          left.previewTask.deadline.getTime() < now.getTime()
            ? 0
            : 1;
        const rightOverdue =
          right.previewTask.deadline &&
          right.previewTask.deadline.getTime() < now.getTime()
            ? 0
            : 1;

        return (
          leftOverdue - rightOverdue ||
          (left.previewTask.deadline?.getTime() ?? Number.MAX_SAFE_INTEGER) -
            (right.previewTask.deadline?.getTime() ??
              Number.MAX_SAFE_INTEGER) ||
          right.updatedAt.getTime() - left.updatedAt.getTime()
        );
      })
      .slice(0, 5)
      .map((task) => ({
        ...task.previewTask,
        kind:
          task.previewTask.deadline &&
          task.previewTask.deadline.getTime() < now.getTime()
            ? 'overdue'
            : 'due-today',
      }));

    const recentTasks = [...normalizedTasks]
      .sort(
        (left, right) => right.updatedAt.getTime() - left.updatedAt.getTime(),
      )
      .slice(0, 5)
      .map((task) => task.previewTask);

    const groupsSummary = Array.from(groupedTasks.entries())
      .map(([groupId, tasks]): MyDashboardGroupItem => {
        const openGroupTasks = tasks.filter(
          (task) => !task.previewTask.status.isCompleted,
        );
        const completedGroupTasks = tasks.filter(
          (task) => task.previewTask.status.isCompleted,
        );
        const overdueGroupTasks = openGroupTasks.filter(
          (task) =>
            task.previewTask.deadline &&
            task.previewTask.deadline.getTime() < now.getTime(),
        );
        const dueTodayGroupTasks = openGroupTasks.filter(
          (task) =>
            task.previewTask.deadline &&
            task.previewTask.deadline.getTime() >= now.getTime() &&
            this._isWithinToday(
              task.previewTask.deadline,
              startOfToday,
              endOfToday,
            ),
        );
        const nextDeadline =
          [...openGroupTasks]
            .filter((task) => Boolean(task.previewTask.deadline))
            .sort(
              (left, right) =>
                (left.previewTask.deadline?.getTime() ??
                  Number.MAX_SAFE_INTEGER) -
                (right.previewTask.deadline?.getTime() ??
                  Number.MAX_SAFE_INTEGER),
            )[0]?.previewTask.deadline ?? null;
        const assignedCount = tasks.length;

        return {
          groupId,
          name: tasks[0].previewTask.group.name,
          role: tasks[0].previewTask.group.role,
          assignedTasks: assignedCount,
          openTasks: openGroupTasks.length,
          completedTasks: completedGroupTasks.length,
          dueTodayCount: dueTodayGroupTasks.length,
          overdueCount: overdueGroupTasks.length,
          completionRate:
            assignedCount > 0
              ? Math.round(
                  (completedGroupTasks.length / assignedCount) * 1000,
                ) / 10
              : 0,
          nextDeadline,
        };
      })
      .sort((left, right) => {
        const leftRank =
          left.overdueCount > 0
            ? 0
            : left.dueTodayCount > 0
              ? 1
              : left.nextDeadline
                ? 2
                : 3;
        const rightRank =
          right.overdueCount > 0
            ? 0
            : right.dueTodayCount > 0
              ? 1
              : right.nextDeadline
                ? 2
                : 3;

        return (
          leftRank - rightRank ||
          (left.nextDeadline?.getTime() ?? Number.MAX_SAFE_INTEGER) -
            (right.nextDeadline?.getTime() ?? Number.MAX_SAFE_INTEGER) ||
          left.name.localeCompare(right.name)
        );
      });

    return {
      summary: {
        assignedTasks: normalizedTasks.length,
        openTasks: openTasks.length,
        completedTasks: completedTasks.length,
        dueTodayCount: dueTodayTasks.length,
        overdueCount: overdueTasks.length,
        groupCount: groupsSummary.length,
      },
      attentionTasks,
      recentTasks,
      groups: groupsSummary,
    };
  }

  private _buildEmptyMyDashboard(): MyDashboardData {
    return {
      summary: {
        assignedTasks: 0,
        openTasks: 0,
        completedTasks: 0,
        dueTodayCount: 0,
        overdueCount: 0,
        groupCount: 0,
      },
      attentionTasks: [],
      recentTasks: [],
      groups: [],
    };
  }

  private _isWithinToday(
    date: Date,
    startOfToday: Date,
    endOfToday: Date,
  ): boolean {
    return (
      date.getTime() >= startOfToday.getTime() &&
      date.getTime() <= endOfToday.getTime()
    );
  }
}
