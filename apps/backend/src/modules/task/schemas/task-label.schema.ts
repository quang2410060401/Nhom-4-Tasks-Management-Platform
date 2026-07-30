import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type TaskLabelDocument = HydratedDocument<TaskLabel>;

/**
 * Collection: task_labels
 * Join-table ánh xạ many-to-many giữa tasks và labels trong cùng một nhóm.
 *
 * Mỗi bản ghi = task đã được gắn một label cụ thể.
 * Cascade delete phải được xử lý ở tầng service:
 *   - Khi xóa task        → deleteMany({ taskId })
 *   - Khi xóa label       → deleteMany({ labelId })
 *   - Khi update labelIds → xóa cũ, insert mới trong cùng transaction
 */
@Schema({ collection: 'task_labels', timestamps: false })
export class TaskLabel {
  /** Tham chiếu đến task. */
  @Prop({ required: true, type: Types.ObjectId, ref: 'Task', index: true })
  taskId!: Types.ObjectId;

  /** Tham chiếu đến label (thuộc cùng group với task). */
  @Prop({ required: true, type: Types.ObjectId, ref: 'Label', index: true })
  labelId!: Types.ObjectId;
}

export const TaskLabelSchema = SchemaFactory.createForClass(TaskLabel);

// ---------------------------------------------------------------------------
// Indexes
// ---------------------------------------------------------------------------

/**
 * Unique compound index — đảm bảo mỗi cặp (taskId, labelId) chỉ tồn tại một lần.
 * Cũng phục vụ lookup labels của một task.
 */
TaskLabelSchema.index({ taskId: 1, labelId: 1 }, { unique: true });
