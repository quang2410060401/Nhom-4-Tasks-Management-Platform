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
import type { AuthenticatedGroupRequest } from '../types/group-request.type';
import { Group, GroupDocument } from '../schemas/group.schema';

/**
 * Guard kiểm tra user đã đăng nhập là owner của nhóm.
 * Sử dụng cho các route chỉ owner được thực hiện:
 * mời thành viên, xóa thành viên, tạo/sửa/xóa status, sửa/xóa label.
 */
@Injectable()
export class GroupOwnerGuard implements CanActivate {
  private readonly logger = new Logger(GroupOwnerGuard.name);

  constructor(
    @InjectModel(Group.name) private readonly groupModel: Model<GroupDocument>,
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

    // Kiểm tra nhóm tồn tại
    const group = await this.groupModel.findById(groupId).lean().exec();
    if (!group) {
      throw new NotFoundException(GROUP_ERRORS.NOT_FOUND);
    }

    // So sánh ownerId với sub của JWT (cả hai đang là string sau .lean())
    const isOwner = group.ownerId.toString() === user.sub;
    if (!isOwner) {
      this.logger.warn(
        `User ${user.sub} cố thực hiện hành động owner trên nhóm ${String(groupId)}`,
      );
      throw new ForbiddenException(GROUP_ERRORS.ONLY_OWNER);
    }

    return true;
  }
}
