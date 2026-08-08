import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';

export type GroupDocument = HydratedDocument<Group>;

/**
 * Collection: groups
 * Đại diện cho một dự án/nhóm làm việc.
 * ownerId được lưu trực tiếp để tra cứu nhanh mà không cần join group_members.
 */
@Schema({ collection: 'groups', timestamps: true })
export class Group {
  /** Tên nhóm, do người tạo đặt. */
  @Prop({ required: true, trim: true })
  name!: string;

  /** Tên chuẩn hoá lowercase để enforce unique case-insensitive toàn hệ thống. */
  @Prop({ required: true, lowercase: true, trim: true })
  nameNormalized!: string;

  /** Mô tả ngắn cho mục đích và phạm vi của nhóm. */
  @Prop({ type: String, default: null, trim: true })
  description!: string | null;

  /** Ngày bắt đầu kế hoạch của nhóm. */
  @Prop({ type: Date, default: null })
  startDate!: Date | null;

  /** Ngày kết thúc kế hoạch của nhóm. */
  @Prop({ type: Date, default: null })
  endDate!: Date | null;

  /** Tham chiếu đến user đã tạo nhóm — không thay đổi sau khi tạo. */
  @Prop({
    required: true,
    type: SchemaTypes.ObjectId,
    ref: 'User',
    index: true,
  })
  ownerId!: Types.ObjectId;
}

export const GroupSchema = SchemaFactory.createForClass(Group);
GroupSchema.index(
  { nameNormalized: 1 },
  {
    unique: true,
    partialFilterExpression: { nameNormalized: { $type: 'string' } },
  },
);
