import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type StatusDocument = HydratedDocument<Status>;

/**
 * Collection: statuses
 * Mỗi nhóm có danh sách statuses riêng — không dùng chung, không hardcode.
 * 3 statuses mặc định (Todo/Doing/Done) được seed tự động khi tạo nhóm.
 *
 * TODO (batch Task): tham chiếu statusId từ Task schema sau khi Task module được tạo.
 */
@Schema({ collection: 'statuses', timestamps: true })
export class Status {
  /** Nhóm sở hữu status này. */
  @Prop({ required: true, type: Types.ObjectId, ref: 'Group', index: true })
  groupId!: Types.ObjectId;

  /** Tên hiển thị, ví dụ: "Todo", "Đang làm". */
  @Prop({ required: true, trim: true })
  name!: string;

  /**
   * Slug để định danh status theo chuẩn URL.
   * Tự động sinh từ name: lowercase + replace spaces with '-'.
   * Ví dụ: "In Review" → "in-review".
   * Unique trong phạm vi một nhóm.
   */
  @Prop({ required: true, lowercase: true, trim: true })
  slug!: string;

  /** Màu hex hiển thị trên Kanban board. */
  @Prop({ required: true, default: '#6B7280' })
  color!: string;

  /** Thứ tự sắp xếp cột trên Kanban board — tăng dần. */
  @Prop({ required: true, type: Number })
  order!: number;

  /**
   * Status mặc định khi tạo task mà không chỉ định statusId.
   * Mỗi nhóm chỉ có 1 status với isDefault = true (là "Todo").
   */
  @Prop({ required: true, default: false })
  isDefault!: boolean;

  /**
   * Đánh dấu status này tương đương "hoàn thành" (Done).
   * Dùng để tính completionRate và overdue trong Dashboard.
   * TODO (batch Dashboard): dùng trường này khi implement aggregation dashboard.
   */
  @Prop({ required: true, default: false })
  isCompleted!: boolean;
}

export const StatusSchema = SchemaFactory.createForClass(Status);

// Đảm bảo slug duy nhất trong phạm vi một nhóm
StatusSchema.index({ groupId: 1, slug: 1 }, { unique: true });

/**
 * Index để sắp xếp cột Kanban theo order.
 *
 * Lưu ý: index này không phải unique — hai statuses trong cùng nhóm có thể
 * có cùng giá trị order nếu service không xử lý đúng.
 * TODO (batch Status): service.createStatus và reorder phải tính toán order mới
 * trong transaction để tránh trùng giá trị (lấy max(order) + 1 hoặc sắp lại toàn bộ).
 */
StatusSchema.index({ groupId: 1, order: 1 });
