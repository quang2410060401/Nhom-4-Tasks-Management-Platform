import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type {
  GroupMembership,
  GroupRequest,
} from '../types/group-request.type';

/**
 * Trích xuất thông tin membership của user hiện tại từ request.
 *
 * Chỉ dùng được trên các route đã được bảo vệ bởi GroupMemberGuard.
 * GroupMemberGuard đính kèm `groupMembership` vào request ngay sau khi xác nhận
 * user là thành viên — decorator này chỉ đọc lại giá trị đó, không query DB.
 *
 * Usage:
 * ```ts
 * @Get(':groupId')
 * @UseGuards(GroupMemberGuard)
 * async getDetail(@ActiveMembership() membership: GroupMembership) { ... }
 * ```
 */
export const ActiveMembership = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): GroupMembership => {
    const request = ctx.switchToHttp().getRequest<GroupRequest>();
    return request.groupMembership;
  },
);
