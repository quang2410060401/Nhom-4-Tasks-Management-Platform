import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';
import { GroupRole } from '../enums/group-role.enum';
import { InviteStatus } from '../enums/invite-status.enum';

export type GroupInviteDocument = HydratedDocument<GroupInvite>;

/**
 * Collection: group_invites
 * Lưu thông tin lời mời tham gia nhóm.
 * inviteToken là UUID duy nhất, được gửi qua email và dùng để chấp nhận lời mời.
 * TTL index trên expiresAt để MongoDB tự xóa bản ghi hết hạn.
 */
@Schema({ collection: 'group_invites', timestamps: true })
export class GroupInvite {
  /** Nhóm mời thành viên. */
  @Prop({
    required: true,
    type: SchemaTypes.ObjectId,
    ref: 'Group',
    index: true,
  })
  groupId!: Types.ObjectId;

  /** Email của người được mời — dùng để xác nhận khi chấp nhận lời mời. */
  @Prop({ required: true, lowercase: true, trim: true })
  email!: string;

  /** UUID ngẫu nhiên — nhúng vào link email. Không đoán được. */
  @Prop({ required: true, unique: true })
  inviteToken!: string;

  /** Trạng thái lời mời: pending → accepted/expired. */
  @Prop({
    required: true,
    enum: Object.values(InviteStatus),
    type: String,
    default: InviteStatus.PENDING,
  })
  status!: InviteStatus;

  /** Vai trò sẽ được gán khi người dùng chấp nhận lời mời. */
  @Prop({
    required: true,
    enum: Object.values(GroupRole).filter((role) => role !== GroupRole.OWNER),
    type: String,
    default: GroupRole.MEMBER,
  })
  role!: GroupRole;

  /** Thời điểm lời mời hết hạn — mặc định 48h từ khi tạo. */
  @Prop({ required: true, type: Date })
  expiresAt!: Date;
}

export const GroupInviteSchema = SchemaFactory.createForClass(GroupInvite);

// Index kết hợp để kiểm tra invite pending giữa một nhóm và một email
GroupInviteSchema.index({ groupId: 1, email: 1 });

// TTL index: MongoDB tự xóa bản ghi sau khi expiresAt đã qua.
// Khi record bị xóa, lookupToken trả null → service trả "Token không hợp lệ".
// Trường hợp record còn tồn tại nhưng expiresAt < now: service kiểm tra
// expiresAt > now trước khi chấp nhận → trả "Lời mời đã hết hạn".
GroupInviteSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
