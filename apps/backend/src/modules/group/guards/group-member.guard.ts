import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, Model } from 'mongoose';
import type { JwtPayload } from '../../../common/types/jwt-payload.type';
import { GROUP_ERRORS } from '../group.constants';
import { GroupRole } from '../enums/group-role.enum';
import { InviteStatus } from '../enums/invite-status.enum';
import type {
  AuthenticatedGroupRequest,
  GroupMembership,
  GroupRequest,
} from '../types/group-request.type';
import {
  GroupInvite,
  GroupInviteDocument,
} from '../schemas/group-invite.schema';
import {
  GroupMember,
  GroupMemberDocument,
} from '../schemas/group-member.schema';
import { Group, GroupDocument } from '../schemas/group.schema';

/**
 * Guard kiểm tra user đã đăng nhập là thành viên (member hoặc owner) của nhóm.
 * Sử dụng cho mọi route yêu cầu quyền truy cập theo :groupId.
 *
 * Chiến lược query (tối ưu cho happy path):
 * 1. Tìm membership trước — dùng compound unique index {groupId, userId}.
 *    - Nếu tìm thấy: đính kèm vào request.groupMembership và thông qua (1 query).
 *    - Nếu không có: truy vấn Group để phân biệt 404 vs 403 (2 queries tổng).
 *
 * Sau khi guard pass, handler dùng @ActiveMembership() thay vì query lại DB.
 */
@Injectable()
export class GroupMemberGuard implements CanActivate {
  private readonly logger = new Logger(GroupMemberGuard.name);

  constructor(
    @InjectModel(Group.name) private readonly groupModel: Model<GroupDocument>,
    @InjectModel(GroupMember.name)
    private readonly groupMemberModel: Model<GroupMemberDocument>,
    @InjectModel(GroupInvite.name)
    private readonly groupInviteModel: Model<GroupInviteDocument>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<
      AuthenticatedGroupRequest & Partial<GroupRequest>
    >();
    const user: JwtPayload = request.user;
    const groupId = request.params?.groupId;

    if (!groupId || !isValidObjectId(groupId)) {
      throw new BadRequestException('groupId không hợp lệ');
    }

    // Bước 1: tìm membership. Compound unique index {groupId, userId} đảm bảo tra cứu nhanh.
    const member = await this.groupMemberModel
      .findOne({ groupId, userId: user.sub })
      .lean()
      .exec();

    if (member) {
      // Happy path: user là thành viên — đính kèm vào request và thông qua
      const groupMembership: GroupMembership = {
        groupId: member.groupId.toString(),
        userId: member.userId.toString(),
        role: member.role,
        joinedAt: member.joinedAt,
      };
      request.groupMembership = groupMembership;
      return true;
    }

    // Bước 2: không có membership — lấy group để phân biệt 404 vs owner record bị thiếu.
    const group = await this.groupModel
      .findById(groupId)
      .select({ _id: 1, ownerId: 1, createdAt: 1 })
      .lean()
      .exec();

    if (!group) {
      throw new NotFoundException(GROUP_ERRORS.NOT_FOUND);
    }

    // Defensive self-heal:
    // nếu owner record trong group_members bị thiếu do dữ liệu cũ/inconsistent,
    // vẫn cho owner truy cập và tự động bổ sung membership để các query sau ổn định.
    if (group.ownerId.toString() === user.sub) {
      await this.groupMemberModel.updateOne(
        { groupId: group._id, userId: group.ownerId },
        {
          $setOnInsert: {
            role: GroupRole.OWNER,
            joinedAt:
              (group as unknown as { createdAt?: Date }).createdAt ??
              new Date(),
          },
        },
        { upsert: true },
      );

      request.groupMembership = {
        groupId: group._id.toString(),
        userId: group.ownerId.toString(),
        role: GroupRole.OWNER,
        joinedAt:
          (group as unknown as { createdAt?: Date }).createdAt ?? new Date(),
      };

      this.logger.warn(
        `Tự động phục hồi owner membership cho user ${user.sub} trong nhóm ${String(groupId)}`,
      );

      return true;
    }

    // Defensive self-heal cho member đã accept invite trước đó nhưng membership record bị thiếu.
    const acceptedInvite = await this.groupInviteModel
      .findOne({
        groupId: group._id,
        email: user.email.toLowerCase().trim(),
        status: InviteStatus.ACCEPTED,
      })
      .select({ _id: 1, updatedAt: 1, createdAt: 1, role: 1 })
      .lean()
      .exec();

    if (acceptedInvite) {
      const joinedAt =
        (acceptedInvite as unknown as { updatedAt?: Date; createdAt?: Date })
          .updatedAt ??
        (acceptedInvite as unknown as { createdAt?: Date }).createdAt ??
        new Date();

      await this.groupMemberModel.updateOne(
        { groupId: group._id, userId: user.sub },
        {
          $setOnInsert: {
            role: acceptedInvite.role ?? GroupRole.MEMBER,
            joinedAt,
          },
        },
        { upsert: true },
      );

      request.groupMembership = {
        groupId: group._id.toString(),
        userId: user.sub,
        role: acceptedInvite.role ?? GroupRole.MEMBER,
        joinedAt,
      };

      this.logger.warn(
        `Tự động phục hồi member membership cho user ${user.sub} trong nhóm ${String(groupId)} từ accepted invite`,
      );

      return true;
    }

    this.logger.warn(
      `User ${user.sub} cố truy cập nhóm ${String(groupId)} nhưng không phải thành viên`,
    );
    throw new ForbiddenException(GROUP_ERRORS.FORBIDDEN);
  }
}
