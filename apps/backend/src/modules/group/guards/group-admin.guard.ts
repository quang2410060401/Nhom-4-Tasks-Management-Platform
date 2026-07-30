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
import type { AuthenticatedGroupRequest } from '../types/group-request.type';
import {
  GroupMember,
  GroupMemberDocument,
} from '../schemas/group-member.schema';
import { Group, GroupDocument } from '../schemas/group.schema';

@Injectable()
export class GroupAdminGuard implements CanActivate {
  private readonly logger = new Logger(GroupAdminGuard.name);

  constructor(
    @InjectModel(Group.name) private readonly groupModel: Model<GroupDocument>,
    @InjectModel(GroupMember.name)
    private readonly groupMemberModel: Model<GroupMemberDocument>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<AuthenticatedGroupRequest>();
    const user: JwtPayload = request.user;
    const groupId = request.params?.groupId;

    if (!groupId || !isValidObjectId(groupId)) {
      throw new BadRequestException('groupId không hợp lệ');
    }

    const group = await this.groupModel
      .findById(groupId)
      .select({ _id: 1, ownerId: 1, createdAt: 1 })
      .lean()
      .exec();

    if (!group) {
      throw new NotFoundException(GROUP_ERRORS.NOT_FOUND);
    }

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

      return true;
    }

    const membership = await this.groupMemberModel
      .findOne({ groupId: group._id, userId: user.sub })
      .select({ role: 1 })
      .lean()
      .exec();

    const isManager =
      membership?.role === GroupRole.OWNER ||
      membership?.role === GroupRole.ADMIN;

    if (!isManager) {
      this.logger.warn(
        `User ${user.sub} cố thực hiện hành động quản trị trên nhóm ${String(groupId)}`,
      );
      throw new ForbiddenException(GROUP_ERRORS.ONLY_MANAGER);
    }

    return true;
  }
}
