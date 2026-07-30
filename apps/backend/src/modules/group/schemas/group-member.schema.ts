import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { GroupRole } from '../enums/group-role.enum';

export type GroupMemberDocument = HydratedDocument<GroupMember>;

/**
 * Collection: group_members
 * Lưu quan hệ many-to-many giữa User và Group.
 * Compound unique index { groupId, userId } đảm bảo mỗi user chỉ tham gia nhóm một lần.
 */
@Schema({ collection: 'group_members', timestamps: true })
export class GroupMember {
  /** Tham chiếu đến nhóm. */
  @Prop({ required: true, type: Types.ObjectId, ref: 'Group', index: true })
  groupId!: Types.ObjectId;

  /** Tham chiếu đến user thành viên. */
  @Prop({ required: true, type: Types.ObjectId, ref: 'User', index: true })
  userId!: Types.ObjectId;

  /** Vai trò của thành viên trong nhóm: owner hoặc member. */
  @Prop({ required: true, enum: Object.values(GroupRole), type: String })
  role!: GroupRole;

  /**
   * Thời điểm user gia nhập nhóm.
   * Trường riêng biệt (không phải alias của createdAt từ timestamps).
   * - Owner: được set tại thời điểm group được tạo.
   * - Member: được set tại thời điểm chấp nhận lời mời (acceptInvite).
   */
  @Prop({ type: Date, default: () => new Date() })
  joinedAt!: Date;
}

export const GroupMemberSchema = SchemaFactory.createForClass(GroupMember);

// Đảm bảo mỗi user chỉ tồn tại một lần trong một nhóm
GroupMemberSchema.index({ groupId: 1, userId: 1 }, { unique: true });
