import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MailModule } from '../../common/mail/mail.module';
import { User, UserSchema } from '../auth/schemas/user.schema';
import { Group, GroupSchema } from './schemas/group.schema';
import { GroupMember, GroupMemberSchema } from './schemas/group-member.schema';
import { GroupInvite, GroupInviteSchema } from './schemas/group-invite.schema';
import { Status, StatusSchema } from './schemas/status.schema';
import { Label, LabelSchema } from './schemas/label.schema';
import { GroupController } from './group.controller';
import { GroupService } from './group.service';
import { AuthModule } from '../auth/auth.module';
import { TaskModule } from '../task/task.module';
import { GroupGuardsModule } from './group-guards.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Group.name, schema: GroupSchema },
      { name: GroupMember.name, schema: GroupMemberSchema },
      { name: GroupInvite.name, schema: GroupInviteSchema },
      { name: Status.name, schema: StatusSchema },
      { name: Label.name, schema: LabelSchema },
      // User schema đăng ký riêng trong module này để tra cứu email khi gửi lời mời
      { name: User.name, schema: UserSchema },
    ]),
    // Re-export AuthModule để sử dụng JwtAuthGuard và PassportModule
    AuthModule,
    // MailModule để GroupService có thể inject MailService gửi email lời mời
    MailModule,
    // TaskModule cung cấp Task + TaskLabel models cho GroupService
    // (removeMember → unassign, deleteStatus → count check, deleteLabel → cascade)
    TaskModule,
    // GroupGuardsModule cung cấp GroupMemberGuard + GroupOwnerGuard
    // (guards tách riêng để tránh circular dep với TaskModule)
    GroupGuardsModule,
  ],
  controllers: [GroupController],
  providers: [GroupService],
  exports: [GroupService],
})
export class GroupModule {}
