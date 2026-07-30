import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Group, GroupSchema } from './schemas/group.schema';
import { GroupMember, GroupMemberSchema } from './schemas/group-member.schema';
import { GroupInvite, GroupInviteSchema } from './schemas/group-invite.schema';
import { GroupAdminGuard } from './guards/group-admin.guard';
import { GroupMemberGuard } from './guards/group-member.guard';
import { GroupOwnerGuard } from './guards/group-owner.guard';

/**
 * GroupGuardsModule — module độc lập cung cấp 2 authorization guards.
 *
 * Mục đích tách riêng:
 *   Cả GroupModule và TaskModule đều cần GroupMemberGuard / GroupOwnerGuard.
 *   Nếu guards nằm trong GroupModule và TaskModule import GroupModule,
 *   trong khi GroupModule đã import TaskModule → CIRCULAR DEPENDENCY.
 *
 *   Giải pháp: tách guards ra đây, không import GroupModule hay TaskModule.
 *   Dependency graph sau khi tách:
 *
 *     GroupGuardsModule (Group + GroupMember schemas, 2 guards)
 *          ↑ import              ↑ import
 *       GroupModule          TaskModule
 *          ↑ import
 *        TaskModule
 *   → Không có vòng tròn.
 *
 * Mongoose sẽ không đăng ký lại model nếu đã được compile trong cùng connection —
 * việc forFeature() gọi lại cùng tên model từ nhiều module là an toàn.
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Group.name, schema: GroupSchema },
      { name: GroupMember.name, schema: GroupMemberSchema },
      { name: GroupInvite.name, schema: GroupInviteSchema },
    ]),
  ],
  providers: [GroupMemberGuard, GroupOwnerGuard, GroupAdminGuard],
  exports: [GroupMemberGuard, GroupOwnerGuard, GroupAdminGuard],
})
export class GroupGuardsModule {}
