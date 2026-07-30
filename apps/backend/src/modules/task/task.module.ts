import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Task, TaskSchema } from './schemas/task.schema';
import { TaskLabel, TaskLabelSchema } from './schemas/task-label.schema';
import { TaskComment, TaskCommentSchema } from './schemas/task-comment.schema';
import {
  TaskAttachment,
  TaskAttachmentSchema,
} from './schemas/task-attachment.schema';
import { TaskController } from './task.controller';
import { MyTaskController } from './my-task.controller';
import { TaskInternalController } from './task-internal.controller';
import { TaskService } from './task.service';
import { TaskNotificationService } from './task-notification.service';
import { TaskFileStorageService } from './services/task-file-storage.service';
import { AuthModule } from '../auth/auth.module';
import { GroupGuardsModule } from '../group/group-guards.module';
import { Group, GroupSchema } from '../group/schemas/group.schema';
import { Status, StatusSchema } from '../group/schemas/status.schema';
import { Label, LabelSchema } from '../group/schemas/label.schema';
import {
  GroupMember,
  GroupMemberSchema,
} from '../group/schemas/group-member.schema';
import {
  GroupInvite,
  GroupInviteSchema,
} from '../group/schemas/group-invite.schema';
import { User, UserSchema } from '../auth/schemas/user.schema';
import { MailModule } from '../../common/mail/mail.module';

/**
 * TaskModule — quản lý vòng đời của tasks và task_labels.
 *
 * Dependency graph (không có vòng tròn):
 *   AuthModule         → JwtAuthGuard, PassportModule
 *   GroupGuardsModule  → GroupMemberGuard, GroupOwnerGuard (tách riêng để tránh circular)
 *
 * Status, Label, GroupMember, User được đăng ký tại đây để TaskService có thể:
 *   - Resolve default status khi tạo task không truyền statusId
 *   - Validate statusId thuộc cùng group
 *   - Validate assigneeId là thành viên group
 *   - Validate labelIds thuộc cùng group
 *   - Populate creator / assignee / status / labels trong response
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Task.name, schema: TaskSchema },
      { name: TaskLabel.name, schema: TaskLabelSchema },
      { name: TaskComment.name, schema: TaskCommentSchema },
      { name: TaskAttachment.name, schema: TaskAttachmentSchema },
      { name: Group.name, schema: GroupSchema },
      { name: Status.name, schema: StatusSchema },
      { name: Label.name, schema: LabelSchema },
      { name: GroupMember.name, schema: GroupMemberSchema },
      { name: GroupInvite.name, schema: GroupInviteSchema },
      { name: User.name, schema: UserSchema },
    ]),
    // Re-export AuthModule để có JwtAuthGuard trong controller
    AuthModule,
    // GroupGuardsModule cung cấp GroupMemberGuard + GroupOwnerGuard cho TaskController
    // Tách riêng thay vì import GroupModule để tránh circular dependency:
    //   GroupModule → TaskModule → GroupModule
    GroupGuardsModule,
    // MailModule cung cấp MailService cho TaskNotificationService gửi email cron
    MailModule,
  ],
  controllers: [TaskController, MyTaskController, TaskInternalController],
  providers: [TaskService, TaskNotificationService, TaskFileStorageService],
  exports: [
    // Export TaskService để GroupModule sử dụng khi cần
    // (removeMember → unassign tasks, deleteLabel → cascade task_labels)
    TaskService,
    TaskFileStorageService,
    // Export MongooseModule để GroupModule có thể inject Task/TaskLabel models
    MongooseModule,
  ],
})
export class TaskModule {}
