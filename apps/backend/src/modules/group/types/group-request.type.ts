import type { JwtPayload } from '../../../common/types/jwt-payload.type';
import type { GroupRole } from '../enums/group-role.enum';

/**
 * Thông tin membership của user trong một nhóm.
 * Được đính kèm vào request bởi GroupMemberGuard sau khi xác nhận membership.
 * Các handler phía sau có thể dùng @ActiveMembership() để lấy giá trị này
 * mà không cần query lại database.
 */
export interface GroupMembership {
  groupId: string;
  userId: string;
  role: GroupRole;
  joinedAt: Date;
}

export interface GroupRouteParams {
  groupId?: string;
}

export interface AuthenticatedGroupRequest {
  params: GroupRouteParams;
  user: JwtPayload;
}

/**
 * Request mở rộng dùng trong các handler được bảo vệ bởi GroupMemberGuard.
 * `groupMembership` luôn có giá trị khi guard đã pass.
 */
export interface GroupRequest extends AuthenticatedGroupRequest {
  groupMembership: GroupMembership;
}
