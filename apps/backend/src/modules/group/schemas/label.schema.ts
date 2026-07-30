import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type LabelDocument = HydratedDocument<Label>;

/**
 * Collection: labels
 * Nhãn phân loại task — thuộc về một nhóm cụ thể.
 * Tên label là duy nhất trong phạm vi một nhóm.
 *
 * TODO (batch Task): tham chiếu labelId từ task_labels collection sau khi Task module được tạo.
 */
@Schema({ collection: 'labels', timestamps: true })
export class Label {
  /** Nhóm sở hữu label này. */
  @Prop({ required: true, type: Types.ObjectId, ref: 'Group', index: true })
  groupId!: Types.ObjectId;

  /** Tên nhãn, ví dụ: "Bug", "Feature", "Khẩn cấp". */
  @Prop({ required: true, trim: true })
  name!: string;

  /** Màu hex cho nhãn — mặc định xám trung tính. */
  @Prop({ required: true, default: '#6B7280' })
  color!: string;
}

export const LabelSchema = SchemaFactory.createForClass(Label);

/**
 * Index đảm bảo tên label là duy nhất trong một nhóm.
 *
 * Cảnh báo về case-sensitivity:
 * MongoDB so sánh chuỗi theo binary mặc định — "Bug" và "bug" là hai giá trị khác nhau.
 * Index này không ngăn được các label có tên trung khớp chỉ khác hoa/thường.
 *
 * TODO (batch Label): service.createLabel phải kiểm tra tên trùng lặp bằng regex
 * case-insensitive (hoặc collation query) trước khi insert, không đựa vào index này để bắt lỗi.
 * Lâu dài nên dùng collation index: { locale: 'en', strength: 2 }.
 */
LabelSchema.index({ groupId: 1, name: 1 }, { unique: true });
