import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Task, TaskSchema } from '../task/schemas/task.schema';
import { Status, StatusSchema } from '../group/schemas/status.schema';
import { User, UserSchema } from '../auth/schemas/user.schema';
import { Group, GroupSchema } from '../group/schemas/group.schema';
import {
  GroupMember,
  GroupMemberSchema,
} from '../group/schemas/group-member.schema';
import {
  GroupInvite,
  GroupInviteSchema,
} from '../group/schemas/group-invite.schema';
import { AuthModule } from '../auth/auth.module';
import { GroupGuardsModule } from '../group/group-guards.module';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { PersonalDashboardController } from './personal-dashboard.controller';

/**
 * DashboardModule — cung cấp endpoint GET /groups/:groupId/dashboard.
 *
 * Dependency graph (không có vòng tròn):
 *   AuthModule         → JwtAuthGuard, PassportModule
 *   GroupGuardsModule  → GroupMemberGuard (tách riêng để tránh circular dep)
 *
 * Models được đăng ký tại đây để DashboardService có thể:
 *   - Task   → aggregate task counts (totalTasks, statusBreakdown, overdueCount, tasksByAssignee)
 *   - Status → join để lấy name/color/isCompleted cho statusBreakdown và overdueCount
 *   - User   → resolve name/avatar của từng assignee trong tasksByAssignee
 *
 * GroupMember không cần đăng ký ở đây — DashboardService không inject model này.
 * GroupGuardsModule (được import) đã đăng ký GroupMember cho GroupMemberGuard.
 *
 * Mongoose không đăng ký lại model nếu đã được compile trong cùng connection —
 * việc forFeature() gọi lại cùng tên model từ nhiều module là an toàn.
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Task.name, schema: TaskSchema },
      { name: Status.name, schema: StatusSchema },
      { name: User.name, schema: UserSchema },
      { name: Group.name, schema: GroupSchema },
      { name: GroupMember.name, schema: GroupMemberSchema },
      { name: GroupInvite.name, schema: GroupInviteSchema },
    ]),
    // Re-export AuthModule để có JwtAuthGuard trong controller
    AuthModule,
    // GroupGuardsModule cung cấp GroupMemberGuard cho DashboardController
    GroupGuardsModule,
  ],
  controllers: [DashboardController, PersonalDashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
