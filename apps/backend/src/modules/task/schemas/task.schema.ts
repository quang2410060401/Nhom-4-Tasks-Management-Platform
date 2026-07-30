import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type TaskDocument = HydratedDocument<Task>;

/**
 * Collection: tasks
 * Đại diện cho một công việc thuộc về một nhóm.
 *
 * Quan hệ:
 *   - groupId   → Group
 *   - statusId  → Status (thuộc cùng group)
 *   - assigneeId → User (phải là member của group, nullable)
 *   - creatorId  → User (tự động set khi tạo)
 *
 * Labels được ánh xạ qua collection task_labels (many-to-many).
 */
@Schema({ collection: 'tasks', timestamps: true })
export class Task {
  /** Tiêu đề công việc — bắt buộc, không được để trống. */
  @Prop({ required: true, trim: true })
  title!: string;

  /** Mô tả chi tiết — tuỳ chọn, mặc định null. */
  @Prop({ type: String, default: null })
  description!: string | null;

  /** Nhóm sở hữu task này. */
  @Prop({ required: true, type: Types.ObjectId, ref: 'Group', index: true })
  groupId!: Types.ObjectId;

  /**
   * Trạng thái hiện tại của task (cột Kanban).
   * Phải thuộc cùng groupId — validate ở tầng service.
   */
  @Prop({ required: true, type: Types.ObjectId, ref: 'Status' })
  statusId!: Types.ObjectId;

  /**
   * Người được giao việc — nullable.
   * Bị reset thành null khi thành viên đó bị xóa khỏi group.
   */
  @Prop({ type: Types.ObjectId, ref: 'User', default: null, index: true })
  assigneeId!: Types.ObjectId | null;

  /** Người tạo task — gán tự động từ JWT, không sửa sau khi tạo. */
  @Prop({ required: true, type: Types.ObjectId, ref: 'User', index: true })
  creatorId!: Types.ObjectId;

  /**
   * Hạn hoàn thành — nullable.
   * Nếu được truyền khi tạo: phải > now (validate ở service).
   * Set null để xóa deadline.
   * Index phục vụ cron job quét task sắp đến hạn / quá hạn.
   */
  @Prop({ type: Date, default: null, index: true })
  deadline!: Date | null;

  /**
   * Timestamp ghi nhận lần cuối cùng email nhắc nhở deadline đã được gửi.
   * null = chưa gửi lần nào.
   * Reset về null khi: deadline thay đổi, assignee thay đổi,
   * hoặc task chuyển từ completed → incomplete.
   */
  @Prop({ type: Date, default: null })
  reminderSentAt!: Date | null;

  /**
   * Timestamp ghi nhận lần cuối cùng email thông báo quá hạn đã được gửi.
   * null = chưa gửi lần nào.
   * Reset về null khi: deadline thay đổi, assignee thay đổi,
   * hoặc task chuyển từ completed → incomplete.
   */
  @Prop({ type: Date, default: null })
  overdueSentAt!: Date | null;
}

export const TaskSchema = SchemaFactory.createForClass(Task);

// ---------------------------------------------------------------------------
// Indexes
// ---------------------------------------------------------------------------

/**
 * Kanban board fetch: lấy tất cả tasks của group theo từng status.
 * Đây là query chính trong GET /groups/:groupId/tasks.
 */
TaskSchema.index({ groupId: 1, statusId: 1 });

/**
 * Lọc theo người được giao — dùng trong Kanban filter và Dashboard.
 * assigneeId đã có single index qua @Prop, nhưng compound với groupId
 * phục vụ query dashboard tasksByAssignee hiệu quả hơn.
 */
TaskSchema.index({ groupId: 1, assigneeId: 1 });

/**
 * Cross-group dashboard / my-tasks:
 *   - match assigneeId hiện tại
 *   - sort theo deadline hoặc updatedAt
 */
TaskSchema.index({ assigneeId: 1, deadline: 1, updatedAt: -1 });

/**
 * Cron job quét deadline:
 *   - reminder: deadline trong 60 phút tới AND reminderSentAt chưa có
 *               hoặc đã cũ hơn 60 phút
 *   - overdue:  deadline < now          AND overdueSentAt  = null
 */
TaskSchema.index({ deadline: 1, reminderSentAt: 1 });
TaskSchema.index({ deadline: 1, overdueSentAt: 1 });
