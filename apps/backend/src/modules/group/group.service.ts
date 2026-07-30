import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import {
  ClientSession,
  isValidObjectId,
  Model,
  PipelineStage,
  Types,
} from 'mongoose';
import { randomUUID } from 'crypto';
import { GroupRole } from './enums/group-role.enum';
import { InviteStatus } from './enums/invite-status.enum';
import {
  DEFAULT_STATUSES,
  GROUP_ERRORS,
  INVITE_TOKEN_TTL_MS,
} from './group.constants';
import { Group, GroupDocument } from './schemas/group.schema';
import {
  GroupMember,
  GroupMemberDocument,
} from './schemas/group-member.schema';
import {
  GroupInvite,
  GroupInviteDocument,
} from './schemas/group-invite.schema';
import { Status, StatusDocument } from './schemas/status.schema';
import { Label, LabelDocument } from './schemas/label.schema';
// Task + TaskLabel models được cung cấp bởi TaskModule (không dùng stub nữa)
import { Task, TaskDocument } from '../task/schemas/task.schema';
import {
  TaskLabel,
  TaskLabelDocument,
} from '../task/schemas/task-label.schema';
import {
  TaskComment,
  TaskCommentDocument,
} from '../task/schemas/task-comment.schema';
import {
  TaskAttachment,
  TaskAttachmentDocument,
} from '../task/schemas/task-attachment.schema';
import { TaskFileStorageService } from '../task/services/task-file-storage.service';
import { User, UserDocument } from '../auth/schemas/user.schema';
import {
  GroupInviteEmailPayload,
  MailService,
} from '../../common/mail/mail.service';
import {
  objectIdsEqual,
  toObjectId,
} from '../../common/utils/object-id.util';
import { CreateGroupDto } from './dto/create-group.dto';
import { InviteMemberDto } from './dto/invite-member.dto';
import { AcceptInviteDto } from './dto/accept-invite.dto';
import { CreateStatusDto } from './dto/create-status.dto';
import { UpdateStatusDto } from './dto/update-status.dto';
import { CreateLabelDto } from './dto/create-label.dto';
import { UpdateLabelDto } from './dto/update-label.dto';
import { UpdateMemberRoleDto } from './dto/update-member-role.dto';
import { GroupStatusInputDto } from './dto/group-status-input.dto';
import { GroupLabelInputDto } from './dto/group-label-input.dto';
import { UpdateGroupDto } from './dto/update-group.dto';
import { ListGroupPresetsQueryDto } from './dto/list-group-presets-query.dto';
import { ListMemberCandidatesQueryDto } from './dto/list-member-candidates-query.dto';
import {
  AcceptInviteResult,
  AssigneeStatItem,
  CreateGroupResult,
  DashboardResult,
  GroupDetailResult,
  GroupInviteInfo,
  GroupListItem,
  GroupMemberInfo,
  GroupPermissionsResult,
  InviteSummaryResult,
  LabelPresetResult,
  LabelResult,
  MemberCandidateResult,
  StatusBreakdownItem,
  StatusPresetResult,
  StatusResult,
  UpdateGroupResult,
} from './group.types';

interface AggregateStatusInput {
  _id?: string;
  name: string;
  slug: string;
  color: string;
  order: number;
  isDefault: boolean;
  isCompleted: boolean;
}

interface AggregateLabelInput {
  _id?: string;
  name: string;
  color: string;
}

interface PendingInviteRecordInfo {
  email: string;
  inviteToken: string;
  role: GroupRole;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// TODO (batch Invite Email): inject MailService khi implement flow gửi email lời mời
// NOTE: Transaction yêu cầu MongoDB Replica Set. Standalone mode sẽ throw lỗi khi
// session.withTransaction() được gọi. Nâng cấp docker-compose để dùng RS nếu cần.

@Injectable()
export class GroupService {
  private readonly logger = new Logger(GroupService.name);

  constructor(
    @InjectModel(Group.name) private readonly groupModel: Model<GroupDocument>,
    @InjectModel(GroupMember.name)
    private readonly groupMemberModel: Model<GroupMemberDocument>,
    @InjectModel(GroupInvite.name)
    private readonly groupInviteModel: Model<GroupInviteDocument>,
    @InjectModel(Status.name)
    private readonly statusModel: Model<StatusDocument>,
    @InjectModel(Label.name) private readonly labelModel: Model<LabelDocument>,
    // Task + TaskLabel models inject từ TaskModule — dùng cho removeMember / deleteStatus / deleteLabel.
    @InjectModel(Task.name) private readonly taskModel: Model<TaskDocument>,
    @InjectModel(TaskLabel.name)
    private readonly taskLabelModel: Model<TaskLabelDocument>,
    @InjectModel(TaskComment.name)
    private readonly taskCommentModel: Model<TaskCommentDocument>,
    @InjectModel(TaskAttachment.name)
    private readonly taskAttachmentModel: Model<TaskAttachmentDocument>,
    // User model đăng ký riêng trong GroupModule để tra cứu thông tin user khi xử lý lời mời
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    private readonly configService: ConfigService,
    private readonly mailService: MailService,
    private readonly taskFileStorageService: TaskFileStorageService,
  ) {}

  // ---------------------------------------------------------------------------
  // POST /groups — Tạo nhóm mới
  // ---------------------------------------------------------------------------

  /**
   * Tạo nhóm mới với owner là currentUser.
   *
   * Luồng (atomic trong 1 transaction):
   * 1. Tạo document Group với ownerId = userId
   * 2. Tạo GroupMember với role = owner
   * 3. Seed 3 default statuses (Todo / Doing / Done) từ DEFAULT_STATUSES
   *
   * Transaction yêu cầu MongoDB Replica Set.
   * Nếu chạy standalone, dùng compensating writes (manual rollback).
   */
  async createGroup(
    dto: CreateGroupDto,
    userId: string,
    userEmail: string,
  ): Promise<CreateGroupResult> {
    const ownerObjectId = toObjectId(userId);
    const { name, normalized } = this._normalizeGroupName(dto.name);
    const description = this._normalizeDescription(dto.description);
    const startDate = this._normalizeGroupDate(dto.startDate, 'startDate');
    const endDate = this._normalizeGroupDate(dto.endDate, 'endDate');
    this._assertValidGroupTimeline(startDate, endDate);
    const statuses = this._normalizeAggregateStatuses(
      dto.statuses ??
        DEFAULT_STATUSES.map((status) => ({
          name: status.name,
          color: status.color,
          isCompleted: status.isCompleted,
        })),
    );
    const labels = this._normalizeAggregateLabels(dto.labels ?? []);
    const inviteEmails = this._normalizeInviteEmails(dto.inviteEmails);

    try {
      const { group, inviteRecords } = await this._runWithOptionalTransaction(
        async (session) => {
          await this._ensureGroupNameAvailable(normalized, undefined, session);

          const createdAt = new Date();
          const group = await this._createGroupRecord(
            {
              name,
              nameNormalized: normalized,
              description,
              startDate,
              endDate,
              ownerId: ownerObjectId,
            },
            session,
          );

          await this._insertGroupMembers(
            [
              {
                groupId: group._id,
                userId: ownerObjectId,
                role: GroupRole.OWNER,
                joinedAt: createdAt,
              },
            ],
            session,
          );

          await this._insertStatusesForGroup(group._id, statuses, session);
          await this._insertLabelsForGroup(group._id, labels, session);

          const inviteRecords = await this._createPendingInviteRecords(
            group._id,
            inviteEmails,
            userEmail,
            session,
          );

          this.logger.log(
            `Nhóm "${group.name}" (${group._id.toString()}) tạo thành công bởi user ${userId}`,
          );

          return { group, inviteRecords };
        },
      );
      const inviteSummary = await this._sendPendingInviteEmails(
        inviteRecords,
        group.name,
        userId,
      );

      return {
        _id: group._id.toString(),
        name: group.name,
        description: group.description ?? null,
        startDate: group.startDate ?? null,
        endDate: group.endDate ?? null,
        ownerId: group.ownerId.toString(),
        createdAt: (group as unknown as { createdAt: Date }).createdAt,
        inviteSummary,
      };
    } catch (error) {
      this._rethrowGroupMutationError(
        `Tạo nhóm thất bại cho user ${userId}`,
        'Tạo nhóm thất bại, vui lòng thử lại',
        error,
      );
    }
  }

  // ---------------------------------------------------------------------------
  // GET /groups — Danh sách nhóm của user
  // ---------------------------------------------------------------------------

  /**
   * Trả danh sách nhóm mà user là thành viên.
   * Kèm theo role của user trong mỗi nhóm và tổng số thành viên.
   *
   * Pipeline:
   * 1. Lọc group_members theo userId
   * 2. $lookup groups để lấy thông tin nhóm
   * 3. $lookup group_members lần 2 để đếm tổng thành viên (tránh N+1)
   * 4. $project theo shape GroupListItem
   */
  async getMyGroups(userId: string): Promise<GroupListItem[]> {
    const userObjectId = toObjectId(userId);

    const results = await this.groupMemberModel.aggregate<GroupListItem>([
      // Lọc theo userId của user hiện tại
      { $match: { userId: userObjectId } },

      // Chịu lỗi dữ liệu cũ: một user chỉ xuất hiện 1 lần trong mỗi group
      {
        $group: {
          _id: '$groupId',
          viewerRolePriority: {
            $max: this._buildRolePriorityExpression('$role'),
          },
        },
      },

      // Lấy thông tin nhóm
      {
        $lookup: {
          from: 'groups',
          localField: '_id',
          foreignField: '_id',
          as: 'groupData',
        },
      },
      { $unwind: '$groupData' },

      // Đếm tổng thành viên của từng nhóm (không query riêng từng nhóm)
      {
        $lookup: {
          from: 'group_members',
          let: { groupId: '$groupData._id' },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ['$groupId', '$$groupId'] },
              },
            },
            { $group: { _id: '$userId' } },
            { $count: 'count' },
          ],
          as: 'memberStats',
        },
      },
      {
        $lookup: {
          from: 'group_members',
          let: { groupId: '$groupData._id' },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ['$groupId', '$$groupId'] },
              },
            },
            {
              $group: {
                _id: '$userId',
                rolePriority: {
                  $max: this._buildRolePriorityExpression('$role'),
                },
                joinedAt: { $min: '$joinedAt' },
              },
            },
            { $sort: { rolePriority: -1, joinedAt: 1 } },
            { $limit: 3 },
            {
              $lookup: {
                from: 'users',
                localField: '_id',
                foreignField: '_id',
                as: 'userInfo',
              },
            },
            { $unwind: '$userInfo' },
            {
              $project: {
                _id: 0,
                userId: { $toString: '$_id' },
                name: '$userInfo.name',
                avatar: '$userInfo.avatar',
              },
            },
          ],
          as: 'memberPreview',
        },
      },
      {
        $lookup: {
          from: 'tasks',
          let: { groupId: '$groupData._id' },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ['$groupId', '$$groupId'] },
              },
            },
            {
              $lookup: {
                from: 'statuses',
                localField: 'statusId',
                foreignField: '_id',
                as: 'statusInfo',
              },
            },
            {
              $unwind: {
                path: '$statusInfo',
                preserveNullAndEmptyArrays: true,
              },
            },
            {
              $group: {
                _id: null,
                totalTasks: { $sum: 1 },
                completedTasks: {
                  $sum: {
                    $cond: [{ $eq: ['$statusInfo.isCompleted', true] }, 1, 0],
                  },
                },
              },
            },
            {
              $addFields: {
                completionRate: {
                  $cond: [
                    { $eq: ['$totalTasks', 0] },
                    0,
                    {
                      $round: [
                        {
                          $multiply: [
                            { $divide: ['$completedTasks', '$totalTasks'] },
                            100,
                          ],
                        },
                        1,
                      ],
                    },
                  ],
                },
              },
            },
            {
              $project: {
                _id: 0,
                completionRate: 1,
              },
            },
          ],
          as: 'taskStats',
        },
      },

      // Tạo shape response
      {
        $project: {
          _id: { $toString: '$groupData._id' },
          name: '$groupData.name',
          description: '$groupData.description',
          startDate: '$groupData.startDate',
          endDate: '$groupData.endDate',
          ownerId: { $toString: '$groupData.ownerId' },
          role: {
            $switch: {
              branches: [
                {
                  case: { $eq: ['$viewerRolePriority', 3] },
                  then: GroupRole.OWNER,
                },
                {
                  case: { $eq: ['$viewerRolePriority', 2] },
                  then: GroupRole.ADMIN,
                },
              ],
              default: GroupRole.MEMBER,
            },
          },
          memberCount: {
            $ifNull: [{ $arrayElemAt: ['$memberStats.count', 0] }, 0],
          },
          memberPreview: '$memberPreview',
          completionRate: {
            $ifNull: [{ $arrayElemAt: ['$taskStats.completionRate', 0] }, 0],
          },
          createdAt: '$groupData.createdAt',
        },
      },

      // Sắp xếp theo thời gian tạo nhóm mới nhất
      { $sort: { createdAt: -1 } },
    ]);

    return results;
  }

  // ---------------------------------------------------------------------------
  // GET /groups/:groupId — Chi tiết nhóm
  // ---------------------------------------------------------------------------

  /**
   * Trả chi tiết nhóm kèm danh sách thành viên đã populate tên/email/avatar.
   * Access control đã được xử lý bởi GroupMemberGuard — không cần check lại ở đây.
   *
   * Pipeline members:
   * 1. Lọc group_members theo groupId
   * 2. $lookup users để lấy tên/email/avatar
   * 3. $project theo shape GroupMemberInfo
   */
  async getGroupDetail(
    groupId: string,
    viewerRole: GroupRole = GroupRole.MEMBER,
  ): Promise<GroupDetailResult> {
    const groupObjectId = toObjectId(groupId);
    const now = new Date();

    // Query group, members và pending invites song song — không cần await tuần tự
    const [group, members, invites] = await Promise.all([
      this.groupModel.findById(groupObjectId).lean().exec(),

      this.groupMemberModel.aggregate<GroupMemberInfo>([
        { $match: { groupId: groupObjectId } },

        // Chịu lỗi dữ liệu cũ: gộp duplicate membership theo userId
        {
          $group: {
            _id: '$userId',
            rolePriority: {
              $max: this._buildRolePriorityExpression('$role'),
            },
            joinedAt: { $min: '$joinedAt' },
          },
        },

        // Populate thông tin user (tên, email, avatar)
        {
          $lookup: {
            from: 'users',
            localField: '_id',
            foreignField: '_id',
            as: 'userInfo',
          },
        },
        { $unwind: '$userInfo' },

        {
          $project: {
            _id: 0,
            userId: { $toString: '$_id' },
            name: '$userInfo.name',
            email: '$userInfo.email',
            avatar: '$userInfo.avatar',
            role: {
              $switch: {
                branches: [
                  {
                    case: { $eq: ['$rolePriority', 3] },
                    then: GroupRole.OWNER,
                  },
                  {
                    case: { $eq: ['$rolePriority', 2] },
                    then: GroupRole.ADMIN,
                  },
                ],
                default: GroupRole.MEMBER,
              },
            },
            joinedAt: '$joinedAt',
            rolePriority: '$rolePriority',
          },
        },

        // Sắp xếp: owner lên đầu, sau đó theo joinedAt
        { $sort: { rolePriority: -1, joinedAt: 1 } },
        {
          $project: {
            rolePriority: 0,
          },
        },
      ]),

      this.groupInviteModel.aggregate<GroupInviteInfo>([
        {
          $match: {
            groupId: groupObjectId,
            status: InviteStatus.PENDING,
            expiresAt: { $gt: now },
          },
        },
        { $sort: { createdAt: -1 } },

        // Chỉ giữ lời mời pending mới nhất cho mỗi email để UI không bị duplicate
        {
          $group: {
            _id: '$email',
            latestInvite: { $first: '$$ROOT' },
          },
        },
        { $replaceRoot: { newRoot: '$latestInvite' } },
        {
          $lookup: {
            from: 'users',
            localField: 'email',
            foreignField: 'email',
            as: 'userInfo',
          },
        },
        {
          $unwind: {
            path: '$userInfo',
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $lookup: {
            from: 'group_members',
            let: {
              groupId: '$groupId',
              invitedUserId: '$userInfo._id',
            },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ['$groupId', '$$groupId'] },
                      { $eq: ['$userId', '$$invitedUserId'] },
                    ],
                  },
                },
              },
              { $limit: 1 },
            ],
            as: 'memberInfo',
          },
        },
        {
          $match: {
            $or: [{ userInfo: null }, { memberInfo: { $eq: [] } }],
          },
        },
        {
          $project: {
            _id: { $toString: '$_id' },
            email: '$email',
            role: '$role',
            status: '$status',
            invitedAt: '$createdAt',
            expiresAt: '$expiresAt',
            userId: {
              $cond: [
                { $ifNull: ['$userInfo._id', false] },
                { $toString: '$userInfo._id' },
                null,
              ],
            },
            name: '$userInfo.name',
            avatar: '$userInfo.avatar',
          },
        },
        { $sort: { invitedAt: -1 } },
      ]),
    ]);

    // Guard đã đảm bảo group tồn tại — nếu null thì đây là lỗi bất thường
    if (!group) {
      throw new InternalServerErrorException('Không thể tải thông tin nhóm');
    }

    return {
      _id: group._id.toString(),
      name: group.name,
      description: group.description ?? null,
      startDate: group.startDate ?? null,
      endDate: group.endDate ?? null,
      ownerId: group.ownerId.toString(),
      viewerRole,
      memberCount: members.length,
      pendingInviteCount: invites.length,
      permissions: this._buildGroupPermissions(viewerRole),
      members,
      invites,
      createdAt: (group as unknown as { createdAt: Date }).createdAt,
    };
  }

  // ---------------------------------------------------------------------------
  // GET /groups/status-presets — Preset statuses toàn hệ thống
  // ---------------------------------------------------------------------------

  async getStatusPresets(
    query: ListGroupPresetsQueryDto,
  ): Promise<StatusPresetResult[]> {
    const limit = Math.min(query.limit ?? 20, 50);
    const searchRegex = this._buildSearchRegex(query.search);

    const pipeline: PipelineStage[] = [];

    if (searchRegex) {
      pipeline.push({
        $match: {
          $or: [{ name: searchRegex }, { slug: searchRegex }],
        },
      });
    }

    pipeline.push(
      {
        $group: {
          _id: {
            slug: '$slug',
            name: '$name',
            color: '$color',
            isCompleted: '$isCompleted',
          },
          usageCount: { $sum: 1 },
        },
      },
      { $sort: { usageCount: -1 as const, '_id.name': 1 as const } },
      { $limit: limit },
    );

    const aggregated = await this.statusModel.aggregate<{
      _id: { slug: string; name: string; color: string; isCompleted: boolean };
      usageCount: number;
    }>(pipeline);

    const presetMap = new Map<string, StatusPresetResult>();

    for (const status of DEFAULT_STATUSES) {
      if (
        searchRegex &&
        !searchRegex.test(status.name) &&
        !searchRegex.test(status.slug)
      ) {
        continue;
      }

      const key = `${status.slug}:${status.color}:${status.isCompleted}`;
      presetMap.set(key, {
        key,
        name: status.name,
        slug: status.slug,
        color: status.color,
        isCompleted: status.isCompleted,
        usageCount: 0,
      });
    }

    for (const row of aggregated) {
      const key = `${row._id.slug}:${row._id.color}:${row._id.isCompleted}`;
      presetMap.set(key, {
        key,
        name: row._id.name,
        slug: row._id.slug,
        color: row._id.color,
        isCompleted: row._id.isCompleted,
        usageCount: row.usageCount,
      });
    }

    return [...presetMap.values()]
      .sort(
        (a, b) => b.usageCount - a.usageCount || a.name.localeCompare(b.name),
      )
      .slice(0, limit);
  }

  // ---------------------------------------------------------------------------
  // GET /groups/label-presets — Preset labels toàn hệ thống
  // ---------------------------------------------------------------------------

  async getLabelPresets(
    query: ListGroupPresetsQueryDto,
  ): Promise<LabelPresetResult[]> {
    const limit = Math.min(query.limit ?? 20, 50);
    const searchRegex = this._buildSearchRegex(query.search);

    const pipeline: PipelineStage[] = [];

    if (searchRegex) {
      pipeline.push({ $match: { name: searchRegex } });
    }

    pipeline.push(
      {
        $group: {
          _id: {
            key: { $toLower: '$name' },
            name: '$name',
            color: '$color',
          },
          usageCount: { $sum: 1 },
        },
      },
      { $sort: { usageCount: -1 as const, '_id.name': 1 as const } },
      { $limit: limit },
    );

    const aggregated = await this.labelModel.aggregate<{
      _id: { key: string; name: string; color: string };
      usageCount: number;
    }>(pipeline);

    return aggregated.map((row) => ({
      key: `${row._id.key}:${row._id.color}`,
      name: row._id.name,
      color: row._id.color,
      usageCount: row.usageCount,
    }));
  }

  // ---------------------------------------------------------------------------
  // GET /groups/member-candidates — User candidates để mời
  // ---------------------------------------------------------------------------

  async getMemberCandidates(
    query: ListMemberCandidatesQueryDto,
    requesterId: string,
  ): Promise<MemberCandidateResult[]> {
    const limit = Math.min(query.limit ?? 20, 50);
    const searchRegex = this._buildSearchRegex(query.search);
    const requesterObjectId = toObjectId(requesterId);

    const users = await this.userModel
      .find({
        _id: { $ne: requesterObjectId },
        ...(searchRegex
          ? {
              $or: [{ name: searchRegex }, { email: searchRegex }],
            }
          : {}),
      })
      .sort({ isEmailVerified: -1, name: 1 })
      .limit(limit)
      .select({ _id: 1, name: 1, email: 1, avatar: 1 })
      .lean()
      .exec();

    return users.map((user) => ({
      userId: user._id.toString(),
      name: user.name,
      email: user.email,
      avatar: user.avatar ?? null,
    }));
  }

  // ---------------------------------------------------------------------------
  // PATCH /groups/:groupId — Cập nhật metadata cơ bản
  // ---------------------------------------------------------------------------

  async updateGroup(
    groupId: string,
    dto: UpdateGroupDto,
    requesterId: string,
    requesterEmail: string,
  ): Promise<UpdateGroupResult> {
    const groupObjectId = toObjectId(groupId);
    const normalizedName =
      dto.name !== undefined ? this._normalizeGroupName(dto.name) : null;
    const description =
      dto.description !== undefined
        ? this._normalizeDescription(dto.description)
        : undefined;
    const startDate =
      dto.startDate !== undefined
        ? this._normalizeGroupDate(dto.startDate, 'startDate')
        : undefined;
    const endDate =
      dto.endDate !== undefined
        ? this._normalizeGroupDate(dto.endDate, 'endDate')
        : undefined;
    const statuses =
      dto.statuses !== undefined
        ? this._normalizeAggregateStatuses(dto.statuses)
        : undefined;
    const labels =
      dto.labels !== undefined
        ? this._normalizeAggregateLabels(dto.labels)
        : undefined;
    const inviteEmails = this._normalizeInviteEmails(dto.inviteEmails);
    const removeMemberUserIds = [...new Set(dto.removeMemberUserIds ?? [])];

    try {
      const { group, inviteRecords } = await this._runWithOptionalTransaction(
        async (session) => {
          const existingGroup = await this.groupModel
            .findById(groupObjectId)
            .session(session ?? null)
            .exec();

          if (!existingGroup) {
            throw new NotFoundException(GROUP_ERRORS.NOT_FOUND);
          }

          const currentNameNormalized =
            existingGroup.nameNormalized ??
            existingGroup.name.trim().toLowerCase();
          const nextName = normalizedName?.name ?? existingGroup.name;
          const nextNameNormalized =
            normalizedName?.normalized ?? currentNameNormalized;
          const nextDescription =
            description !== undefined
              ? description
              : (existingGroup.description ?? null);
          const nextStartDate =
            startDate !== undefined
              ? startDate
              : (existingGroup.startDate ?? null);
          const nextEndDate =
            endDate !== undefined ? endDate : (existingGroup.endDate ?? null);

          this._assertValidGroupTimeline(nextStartDate, nextEndDate);

          if (nextNameNormalized !== currentNameNormalized) {
            await this._ensureGroupNameAvailable(
              nextNameNormalized,
              groupObjectId,
              session,
            );
          }

          const metadataUpdate: Record<string, unknown> = {};
          if (nextName !== existingGroup.name) {
            metadataUpdate.name = nextName;
          }
          if (nextNameNormalized !== currentNameNormalized) {
            metadataUpdate.nameNormalized = nextNameNormalized;
          }
          if (nextDescription !== (existingGroup.description ?? null)) {
            metadataUpdate.description = nextDescription;
          }
          if (
            !this._isSameDate(nextStartDate, existingGroup.startDate ?? null)
          ) {
            metadataUpdate.startDate = nextStartDate;
          }
          if (!this._isSameDate(nextEndDate, existingGroup.endDate ?? null)) {
            metadataUpdate.endDate = nextEndDate;
          }

          if (Object.keys(metadataUpdate).length > 0) {
            existingGroup.set(metadataUpdate);
            await existingGroup.save({ session: session ?? undefined });
          }

          if (statuses) {
            await this._syncAggregateStatuses(groupObjectId, statuses, session);
          }

          if (labels) {
            await this._syncAggregateLabels(groupObjectId, labels, session);
          }

          if (removeMemberUserIds.length > 0) {
            await this._removeMembersInAggregateUpdate(
              groupObjectId,
              removeMemberUserIds,
              requesterId,
              session,
            );
          }

          const inviteRecords = await this._createPendingInviteRecords(
            groupObjectId,
            inviteEmails,
            requesterEmail,
            session,
          );

          return { group: existingGroup, inviteRecords };
        },
      );
      const inviteSummary = await this._sendPendingInviteEmails(
        inviteRecords,
        group.name,
        requesterId,
      );

      return {
        _id: group._id.toString(),
        name: group.name,
        description: group.description ?? null,
        startDate: group.startDate ?? null,
        endDate: group.endDate ?? null,
        ownerId: group.ownerId.toString(),
        createdAt: (group as unknown as { createdAt: Date }).createdAt,
        updatedAt: (group as unknown as { updatedAt: Date }).updatedAt,
        inviteSummary,
      };
    } catch (error) {
      this._rethrowGroupMutationError(
        `Cập nhật nhóm ${groupId} thất bại`,
        'Cập nhật nhóm thất bại, vui lòng thử lại',
        error,
      );
    }
  }

  async deleteGroup(groupId: string): Promise<void> {
    const groupObjectId = toObjectId(groupId);

    try {
      await this._runWithOptionalTransaction(async (session) => {
        const groupQuery = this.groupModel
          .findById(groupObjectId)
          .select({ _id: 1 });
        if (session) {
          groupQuery.session(session);
        }

        const group = await groupQuery.lean().exec();
        if (!group) {
          throw new NotFoundException(GROUP_ERRORS.NOT_FOUND);
        }

        const labelQuery = this.labelModel
          .find({ groupId: groupObjectId })
          .select({ _id: 1 });
        if (session) {
          labelQuery.session(session);
        }
        const labels = await labelQuery.lean().exec();
        const labelIds = labels.map((label) => label._id);

        if (labelIds.length > 0) {
          await this.taskLabelModel.deleteMany(
            { labelId: { $in: labelIds } },
            session ? { session } : undefined,
          );
        }

        await this.taskModel.deleteMany(
          { groupId: groupObjectId },
          session ? { session } : undefined,
        );
        await this.taskCommentModel.deleteMany(
          { groupId: groupObjectId },
          session ? { session } : undefined,
        );
        await this.taskAttachmentModel.deleteMany(
          { groupId: groupObjectId },
          session ? { session } : undefined,
        );
        await this.statusModel.deleteMany(
          { groupId: groupObjectId },
          session ? { session } : undefined,
        );
        await this.labelModel.deleteMany(
          { groupId: groupObjectId },
          session ? { session } : undefined,
        );
        await this.groupMemberModel.deleteMany(
          { groupId: groupObjectId },
          session ? { session } : undefined,
        );
        await this.groupInviteModel.deleteMany(
          { groupId: groupObjectId },
          session ? { session } : undefined,
        );
        await this.groupModel.deleteOne(
          { _id: groupObjectId },
          session ? { session } : undefined,
        );
      });

      await this.taskFileStorageService.deleteGroupDirectory(groupId);
      this.logger.log(`Nhóm ${groupId} đã được xóa`);
    } catch (error) {
      this._rethrowGroupMutationError(
        `Xóa nhóm ${groupId} thất bại`,
        'Xóa nhóm thất bại, vui lòng thử lại',
        error,
      );
    }
  }

  // ---------------------------------------------------------------------------
  // POST /groups/:groupId/invites — Mời thành viên
  // ---------------------------------------------------------------------------

  /**
   * Owner gửi lời mời qua email. Tạo invite record với token duy nhất và expiresAt = now+48h.
   *
   * Luồng:
   * 1. Kiểm tra email đã là thành viên nhóm chưa (lookup user → group_members)
   * 2. Kiểm tra lời mời pending chưa hết hạn có tồn tại không
   * 3. Tạo record group_invites
   * 4. Gửi email — nếu thất bại, xóa record vừa tạo (compensating write)
   */
  async inviteMember(
    groupId: string,
    dto: InviteMemberDto,
    inviterId: string,
    inviterEmail?: string,
  ): Promise<void> {
    const groupObjectId = toObjectId(groupId);
    const email = dto.email.toLowerCase().trim();
    const targetRole = dto.role ?? GroupRole.MEMBER;

    const [group, inviter] = await Promise.all([
      this.groupModel.findById(groupObjectId).select({ name: 1 }).lean().exec(),
      inviterEmail
        ? this.userModel.findById(inviterId).select({ name: 1 }).lean().exec()
        : this.userModel
            .findById(inviterId)
            .select({ name: 1, email: 1 })
            .lean()
            .exec(),
    ]);
    const inviteRecords = await this._createPendingInviteRecords(
      groupObjectId,
      [email],
      inviterEmail ?? inviter?.email ?? '',
      undefined,
      targetRole,
    );
    const inviteSummary = await this._sendPendingInviteEmails(
      inviteRecords,
      group?.name ?? 'nhóm',
      inviterId,
    );

    if (inviteSummary.failedEmails.length > 0) {
      throw new InternalServerErrorException(
        'Không thể gửi email lời mời, vui lòng thử lại',
      );
    }

    this.logger.log(
      `Lời mời gửi đến ${email} cho nhóm ${groupId} bởi user ${inviterId}`,
    );
  }

  // ---------------------------------------------------------------------------
  // POST /groups/invites/accept — Chấp nhận lời mời
  // ---------------------------------------------------------------------------

  /**
   * User chấp nhận lời mời bằng token từ email.
   *
   * Luồng:
   * 1. Tìm invite theo token — 404 = token không hợp lệ
   * 2. Kiểm tra email của user khớp với email trên invite (bảo mật)
   * 3. Kiểm tra trạng thái: status=PENDING và expiresAt > now
   * 4. Kiểm tra user chưa là thành viên nhóm
   * 5. Transaction: insert group_members + cập nhật invite status = ACCEPTED
   *
   * Transaction yêu cầu MongoDB Replica Set (giống createGroup).
   */
  async acceptInvite(
    dto: AcceptInviteDto,
    userId: string,
    userEmail: string,
  ): Promise<AcceptInviteResult> {
    // Bước 1: Tìm invite theo token — phải tồn tại
    const invite = await this.groupInviteModel
      .findOne({ inviteToken: dto.token })
      .lean()
      .exec();

    if (!invite) {
      throw new BadRequestException(GROUP_ERRORS.INVITE_INVALID_TOKEN);
    }

    // Bước 2: Xác nhận email của user khớp với email trên invite
    // Bảo vệ: ngăn user khác dùng token không phải của mình
    // Dùng same error code để không lộ thông tin token tồn tại
    if (invite.email !== userEmail.toLowerCase().trim()) {
      throw new BadRequestException(GROUP_ERRORS.INVITE_EMAIL_MISMATCH);
    }

    const userObjectId = toObjectId(userId);
    const [isAlreadyMember, group] = await Promise.all([
      this.groupMemberModel
        .exists({ groupId: invite.groupId, userId: userObjectId })
        .exec(),
      this.groupModel
        .findById(invite.groupId)
        .select({ name: 1 })
        .lean()
        .exec(),
    ]);

    // Idempotent behavior:
    // nếu user đã là member rồi thì coi như accept thành công, kể cả token đã accepted.
    if (isAlreadyMember) {
      if (
        invite.status === InviteStatus.PENDING &&
        invite.expiresAt > new Date()
      ) {
        await this.groupInviteModel
          .updateMany(
            {
              groupId: invite.groupId,
              email: invite.email,
              status: InviteStatus.PENDING,
            },
            { $set: { status: InviteStatus.ACCEPTED } },
          )
          .exec();
      }

      return {
        groupId: invite.groupId.toString(),
        groupName: group?.name ?? '',
      };
    }

    // Bước 3: Kiểm tra trạng thái và hạn sử dụng
    if (invite.status !== InviteStatus.PENDING) {
      throw new BadRequestException(GROUP_ERRORS.INVITE_EXPIRED);
    }

    const now = new Date();
    if (invite.expiresAt <= now) {
      throw new BadRequestException(GROUP_ERRORS.INVITE_EXPIRED);
    }

    // Bước 5: Transaction — insert group_members + update invite status
    const session = await this._startSession();
    let groupName = group?.name ?? '';

    try {
      await this._runWithExistingSessionFallback(
        session,
        async (activeSession) => {
          const joinedAt = new Date();

          // Tạo membership với role = member
          await this._insertGroupMembers(
            [
              {
                groupId: invite.groupId,
                userId: userObjectId,
                role: invite.role ?? GroupRole.MEMBER,
                joinedAt,
              },
            ],
            activeSession,
          );

          // Đánh dấu invite đã được chấp nhận — ngăn tái sử dụng token
          await this.groupInviteModel.updateMany(
            {
              groupId: invite.groupId,
              email: invite.email,
              status: InviteStatus.PENDING,
            },
            { $set: { status: InviteStatus.ACCEPTED } },
            activeSession ? { session: activeSession } : undefined,
          );

          // Lấy tên nhóm cho response trong cùng session
          const groupDoc = await this.groupModel
            .findById(invite.groupId)
            .select({ name: 1 })
            .lean()
            .session(activeSession ?? null)
            .exec();

          groupName = groupDoc?.name ?? groupName;
        },
      );

      this.logger.log(
        `User ${userId} đã tham gia nhóm ${invite.groupId.toString()} qua lời mời`,
      );

      return {
        groupId: invite.groupId.toString(),
        groupName,
      };
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }

      if (this._isMongoDuplicateKeyError(error)) {
        return {
          groupId: invite.groupId.toString(),
          groupName,
        };
      }

      this.logger.error(`Chấp nhận lời mời thất bại cho user ${userId}`, error);
      throw new InternalServerErrorException(
        'Không thể chấp nhận lời mời, vui lòng thử lại',
      );
    } finally {
      await session.endSession();
    }
  }

  // ---------------------------------------------------------------------------
  // DELETE /groups/:groupId/members/:userId — Xóa thành viên
  // ---------------------------------------------------------------------------

  /**
   * Owner xóa thành viên khỏi nhóm.
   * Sau khi xóa, unassign toàn bộ tasks được giao cho thành viên đó trong nhóm.
   *
   * Guard đảm bảo requester là owner, vì vậy kiểm tra target === requester
   * tương đương với kiểm tra target === ownerId theo spec.
   */
  async removeMember(
    groupId: string,
    targetUserId: string,
    _requesterId: string,
  ): Promise<void> {
    void _requesterId;

    // H2: Validate ObjectId trước khi truyền vào new Types.ObjectId()
    if (!isValidObjectId(targetUserId)) {
      throw new BadRequestException('userId không hợp lệ');
    }

    const groupObjectId = toObjectId(groupId);
    const targetObjectId = toObjectId(targetUserId);
    const group = await this.groupModel
      .findById(groupObjectId)
      .select({ ownerId: 1 })
      .lean()
      .exec();

    if (!group) {
      throw new NotFoundException(GROUP_ERRORS.NOT_FOUND);
    }

    if (objectIdsEqual(targetObjectId, group.ownerId)) {
      throw new BadRequestException(GROUP_ERRORS.CANNOT_REMOVE_OWNER);
    }

    // Kiểm tra target có phải thành viên không
    const memberRecord = await this.groupMemberModel
      .findOne({ groupId: groupObjectId, userId: targetObjectId })
      .select({ _id: 1 })
      .lean()
      .exec();

    if (!memberRecord) {
      // M1 B6: dùng TARGET_NOT_MEMBER (không phải NOT_MEMBER) — mô tả đúng người bị xóa
      throw new BadRequestException(GROUP_ERRORS.TARGET_NOT_MEMBER);
    }

    const session = await this._startSession();
    try {
      await this._runWithExistingSessionFallback(
        session,
        async (activeSession) => {
          // Xóa membership
          await this.groupMemberModel.deleteOne(
            { groupId: groupObjectId, userId: targetObjectId },
            activeSession ? { session: activeSession } : undefined,
          );
          // Unassign tất cả tasks trong group được giao cho member này
          await this.taskModel.updateMany(
            { groupId: groupObjectId, assigneeId: targetObjectId },
            { $set: { assigneeId: null } },
            activeSession ? { session: activeSession } : undefined,
          );
        },
      );
    } finally {
      await session.endSession();
    }
  }

  async updateMemberRole(
    groupId: string,
    targetUserId: string,
    dto: UpdateMemberRoleDto,
  ): Promise<void> {
    if (!isValidObjectId(targetUserId)) {
      throw new BadRequestException('userId không hợp lệ');
    }

    const groupObjectId = toObjectId(groupId);
    const targetObjectId = toObjectId(targetUserId);

    const [group, membership] = await Promise.all([
      this.groupModel
        .findById(groupObjectId)
        .select({ ownerId: 1 })
        .lean()
        .exec(),
      this.groupMemberModel
        .findOne({ groupId: groupObjectId, userId: targetObjectId })
        .select({ _id: 1, role: 1 })
        .lean()
        .exec(),
    ]);

    if (!group) {
      throw new NotFoundException(GROUP_ERRORS.NOT_FOUND);
    }

    if (!membership) {
      throw new BadRequestException(GROUP_ERRORS.TARGET_NOT_MEMBER);
    }

    if (objectIdsEqual(targetObjectId, group.ownerId)) {
      throw new BadRequestException(GROUP_ERRORS.CANNOT_CHANGE_OWNER_ROLE);
    }

    await this.groupMemberModel.updateOne(
      { groupId: groupObjectId, userId: targetObjectId },
      { $set: { role: dto.role } },
    );
  }

  async revokeInvite(groupId: string, inviteId: string): Promise<void> {
    if (!isValidObjectId(inviteId)) {
      throw new BadRequestException('inviteId không hợp lệ');
    }

    const result = await this.groupInviteModel.updateOne(
      {
        _id: toObjectId(inviteId),
        groupId: toObjectId(groupId),
        status: InviteStatus.PENDING,
      },
      { $set: { status: InviteStatus.EXPIRED } },
    );

    if (result.matchedCount === 0) {
      throw new NotFoundException(GROUP_ERRORS.INVITE_NOT_FOUND);
    }
  }

  // ---------------------------------------------------------------------------
  // Status CRUD
  // ---------------------------------------------------------------------------

  /**
   * Lấy danh sách statuses của nhóm, sắp xếp theo order tăng dần.
   * Access control (member) đã được kiểm tra bởi GroupMemberGuard.
   */
  async getStatuses(groupId: string): Promise<StatusResult[]> {
    const groupObjectId = toObjectId(groupId);
    const statuses = await this.statusModel
      .find({ groupId: groupObjectId })
      .sort({ order: 1 })
      .lean()
      .exec();
    return statuses.map((s) => this._mapStatus(s));
  }

  /**
   * Owner tạo status mới cho nhóm.
   *
   * Luồng:
   * 1. Sinh slug từ name: "In Review" → "in-review", "Đang làm" → "đang-làm"
   * 2. Kiểm tra slug chưa tồn tại trong nhóm
   * 3. Tính order tự động nếu không truyền: max(order) + 1
   * 4. Tạo status với isDefault = false (không bao giờ đl default)
   */
  async createStatus(
    groupId: string,
    dto: CreateStatusDto,
  ): Promise<StatusResult> {
    const groupObjectId = toObjectId(groupId);

    // Sinh slug; giữ ký tự Unicode để slug có nghĩa với tiếng Việt
    const slug = this._toSlug(dto.name);

    // Kiểm tra slug có trùng với status hiện tại trong nhóm không
    const slugConflict = await this.statusModel
      .exists({ groupId: groupObjectId, slug })
      .exec();
    if (slugConflict) {
      throw new BadRequestException(`Slug "${slug}" đã tồn tại trong nhóm này`);
    }

    // Tính order tự động: lấy order lớn nhất hiện tại + 1
    let order = dto.order;
    if (order === undefined) {
      const topStatus = await this.statusModel
        .findOne({ groupId: groupObjectId })
        .sort({ order: -1 })
        .select({ order: 1 })
        .lean()
        .exec();
      order = topStatus ? topStatus.order + 1 : 1;
    }

    const status = await this.statusModel.create({
      groupId: groupObjectId,
      name: dto.name,
      slug,
      color: dto.color ?? '#6B7280',
      order,
      isDefault: false, // Status tạo thêm bởi owner không bao giờ là default
      isCompleted: dto.isCompleted ?? false,
    });

    this.logger.log(
      `Status "${slug}" (order=${order}) tạo thành công trong nhóm ${groupId}`,
    );
    return this._mapStatus(status);
  }

  /**
   * Owner cập nhật status.
   * Scope nghiêm ngặt theo groupId — không thể sửa status của nhóm khác.
   * Nếu name thay đổi → sinh slug mới và kiểm tra uniqueness trước khi lưu.
   */
  async updateStatus(
    groupId: string,
    statusId: string,
    dto: UpdateStatusDto,
  ): Promise<StatusResult> {
    const groupObjectId = toObjectId(groupId);
    const statusObjectId = toObjectId(statusId);

    // Tìm status và đảm bảo nó thuộc đúng nhóm này
    const existing = await this.statusModel
      .findOne({ _id: statusObjectId, groupId: groupObjectId })
      .lean()
      .exec();
    if (!existing) {
      throw new NotFoundException(GROUP_ERRORS.STATUS_NOT_FOUND);
    }

    if (dto.name !== undefined && dto.name.trim().length === 0) {
      throw new BadRequestException('Tên status không được để trống');
    }

    const update: Record<string, unknown> = {};

    if (dto.name !== undefined) {
      const newSlug = this._toSlug(dto.name);
      // Kiểm tra slug mới có trùng với status khác trong nhóm không
      if (newSlug !== existing.slug) {
        const slugConflict = await this.statusModel
          .exists({
            groupId: groupObjectId,
            slug: newSlug,
            _id: { $ne: statusObjectId },
          })
          .exec();
        if (slugConflict) {
          throw new BadRequestException(
            `Slug "${newSlug}" đã tồn tại trong nhóm này`,
          );
        }
      }
      update.name = dto.name;
      update.slug = newSlug;
    }
    if (dto.color !== undefined) update.color = dto.color;
    if (dto.order !== undefined) update.order = dto.order;
    if (dto.isCompleted !== undefined) update.isCompleted = dto.isCompleted;

    const updated = await this.statusModel
      .findOneAndUpdate(
        { _id: statusObjectId, groupId: groupObjectId },
        { $set: update },
        { new: true },
      )
      .lean()
      .exec();

    // Race condition: status bị xóa giữa 2 queries
    if (!updated) {
      throw new NotFoundException(GROUP_ERRORS.STATUS_NOT_FOUND);
    }

    return this._mapStatus(updated);
  }

  /**
   * Xóa status. Không được xóa isDefault=true hoặc khi còn tasks sử dụng.
   * H1 B6: countDocuments + deleteOne được bọc trong transaction để tránh race condition
   * giữa lúc đếm tasks và lúc xóa status (một task có thể được tạo trong khoảng này).
   */
  async deleteStatus(groupId: string, statusId: string): Promise<void> {
    // H2 B6: Validate ObjectId trước khi truyền vào new Types.ObjectId()
    if (!isValidObjectId(statusId)) {
      throw new BadRequestException('statusId không hợp lệ');
    }

    const groupObjectId = toObjectId(groupId);
    const statusObjectId = toObjectId(statusId);

    const status = await this.statusModel
      .findOne({ _id: statusObjectId, groupId: groupObjectId })
      .select({ isDefault: 1 })
      .lean()
      .exec();

    if (!status) {
      throw new NotFoundException(GROUP_ERRORS.STATUS_NOT_FOUND);
    }

    if (status.isDefault) {
      throw new BadRequestException(GROUP_ERRORS.STATUS_CANNOT_DELETE_DEFAULT);
    }

    // Bọc countDocuments + deleteOne trong transaction để đảm bảo atomicity
    const session = await this._startSession();
    try {
      await this._runWithExistingSessionFallback(
        session,
        async (activeSession) => {
          // Đếm tasks trong cùng transaction — không cho task mới chen vào giữa
          const taskCount = await this.taskModel.countDocuments(
            { groupId: groupObjectId, statusId: statusObjectId },
            activeSession ? { session: activeSession } : undefined,
          );

          if (taskCount > 0) {
            throw new BadRequestException(
              GROUP_ERRORS.STATUS_HAS_TASKS(taskCount),
            );
          }

          await this.statusModel.deleteOne(
            { _id: statusObjectId, groupId: groupObjectId },
            activeSession ? { session: activeSession } : undefined,
          );
        },
      );
    } finally {
      await session.endSession();
    }
  }

  // ---------------------------------------------------------------------------
  // Label CRUD
  // ---------------------------------------------------------------------------

  /**
   * Lấy danh sách labels của nhóm, sắp xếp theo tên tăng dần.
   * Access control (member) đã được kiểm tra bởi GroupMemberGuard.
   */
  async getLabels(groupId: string): Promise<LabelResult[]> {
    const groupObjectId = toObjectId(groupId);
    const labels = await this.labelModel
      .find({ groupId: groupObjectId })
      .sort({ name: 1 })
      .lean()
      .exec();
    return labels.map((l) => this._mapLabel(l));
  }

  /**
   * Member tạo label mới trong nhóm.
   *
   * Kiểm tra tên trùng lặp không phân biệt hoa/thường trước khi insert:
   * Index trên DB là binary (case-sensitive), nên phải dùng regex case-insensitive.
   */
  async createLabel(
    groupId: string,
    dto: CreateLabelDto,
  ): Promise<LabelResult> {
    const groupObjectId = toObjectId(groupId);
    const trimmedName = dto.name.trim();

    // Kiểm tra tên trùng trong nhóm, không phân biệt hoa/thường
    const nameConflict = await this.labelModel
      .exists({
        groupId: groupObjectId,
        name: {
          $regex: new RegExp(`^${this._escapeRegex(trimmedName)}$`, 'i'),
        },
      })
      .exec();
    if (nameConflict) {
      throw new BadRequestException(
        `Nhãn "${trimmedName}" đã tồn tại trong nhóm này`,
      );
    }

    const label = await this.labelModel.create({
      groupId: groupObjectId,
      name: trimmedName,
      color: dto.color ?? '#6B7280',
    });

    this.logger.log(
      `Label "${trimmedName}" tạo thành công trong nhóm ${groupId}`,
    );
    return this._mapLabel(label);
  }

  /**
   * Owner cập nhật label.
   * Scope nghiêm ngặt theo groupId — không thể sửa label của nhóm khác.
   * Nếu name thay đổi → kiểm tra trùng tên case-insensitive trước khi lưu.
   */
  async updateLabel(
    groupId: string,
    labelId: string,
    dto: UpdateLabelDto,
  ): Promise<LabelResult> {
    const groupObjectId = toObjectId(groupId);
    const labelObjectId = toObjectId(labelId);

    // Tìm label và đảm bảo nó thuộc đúng nhóm này
    const existing = await this.labelModel
      .findOne({ _id: labelObjectId, groupId: groupObjectId })
      .lean()
      .exec();
    if (!existing) {
      throw new NotFoundException(GROUP_ERRORS.LABEL_NOT_FOUND);
    }

    if (dto.name !== undefined && dto.name.trim().length === 0) {
      throw new BadRequestException('Tên nhãn không được để trống');
    }

    const update: Record<string, unknown> = {};

    if (dto.name !== undefined) {
      const trimmedName = dto.name.trim();
      // So sánh lowercase trước để không chạy query nếu chỉ đổi hoa/thường ở đúng nhãn đang sửa
      if (trimmedName.toLowerCase() !== existing.name.toLowerCase()) {
        const nameConflict = await this.labelModel
          .exists({
            groupId: groupObjectId,
            name: {
              $regex: new RegExp(`^${this._escapeRegex(trimmedName)}$`, 'i'),
            },
            _id: { $ne: labelObjectId },
          })
          .exec();
        if (nameConflict) {
          throw new BadRequestException(
            `Nhãn "${trimmedName}" đã tồn tại trong nhóm này`,
          );
        }
      }
      update.name = trimmedName;
    }
    if (dto.color !== undefined) update.color = dto.color;

    const updated = await this.labelModel
      .findOneAndUpdate(
        { _id: labelObjectId, groupId: groupObjectId },
        { $set: update },
        { new: true },
      )
      .lean()
      .exec();

    // Race condition: label bị xóa giữa 2 queries
    if (!updated) {
      throw new NotFoundException(GROUP_ERRORS.LABEL_NOT_FOUND);
    }

    return this._mapLabel(updated);
  }

  /**
   * Xóa label + cascade xóa toàn bộ records task_labels liên quan.
   */
  async deleteLabel(groupId: string, labelId: string): Promise<void> {
    // H2 B6: Validate ObjectId trước khi truyền vào new Types.ObjectId()
    if (!isValidObjectId(labelId)) {
      throw new BadRequestException('labelId không hợp lệ');
    }

    const groupObjectId = toObjectId(groupId);
    const labelObjectId = toObjectId(labelId);

    const label = await this.labelModel
      .findOne({ _id: labelObjectId, groupId: groupObjectId })
      .select({ _id: 1 })
      .lean()
      .exec();

    if (!label) {
      throw new NotFoundException(GROUP_ERRORS.LABEL_NOT_FOUND);
    }

    const session = await this._startSession();
    try {
      await this._runWithExistingSessionFallback(
        session,
        async (activeSession) => {
          // Cascade: xóa tất cả liên kết task_labels trước
          await this.taskLabelModel.deleteMany(
            { labelId: labelObjectId },
            activeSession ? { session: activeSession } : undefined,
          );
          // Xóa label
          await this.labelModel.deleteOne(
            { _id: labelObjectId, groupId: groupObjectId },
            activeSession ? { session: activeSession } : undefined,
          );
        },
      );
    } finally {
      await session.endSession();
    }
  }

  // ---------------------------------------------------------------------------
  // GET /groups/:groupId/dashboard — Thống kê / Dashboard
  // ---------------------------------------------------------------------------

  /**
   * Tổng hợp số liệu dashboard cho nhóm.
   * Access control (member) đã được kiểm tra bởi GroupMemberGuard.
   *
   * Chiến lược: 3 aggregation pipeline chạy song song (Promise.all) để giảm
   * latency. Tất cả logic isCompleted dựa vào status.isCompleted, không hardcode
   * tên status.
   *
   * Pipeline 1 (statusBreakdown) — bắt đầu từ `statuses`:
   *   Bảo đảm zero-count statuses xuất hiện trong kết quả.
   *   Dùng luôn kết quả này để tính totalTasks và completionRate trên server.
   *
   * Pipeline 2 (overdueCount) — bắt đầu từ `tasks`:
   *   Lọc: deadline < now, deadline != null, sau đó $lookup statuses để lọc
   *   isCompleted = false. Số tasks vượt deadline chưa hoàn thành.
   *
   * Pipeline 3 (tasksByAssignee) — bắt đầu từ `group_members`:
   *   Bao gồm tất cả thành viên (kể cả chưa được giao task). Nested $lookup
   *   tasks → statuses để phân biệt done/total.
   */
  async getDashboard(groupId: string): Promise<DashboardResult> {
    const groupObjectId = toObjectId(groupId);
    const now = new Date();

    // Kiểu nội bộ — giữ isCompleted để tính completionRate, không expose ra client
    type StatusBreakdownRaw = StatusBreakdownItem & { isCompleted: boolean };

    // Chạy 3 aggregation song song — không phụ thuộc lẫn nhau
    const [statusRows, overdueResult, assigneeRows] = await Promise.all([
      // ── PIPELINE 1: Đếm tasks theo từng status (bảo toàn zero-count) ────────────
      this.statusModel.aggregate<StatusBreakdownRaw>([
        // Lọc để chỉ lấy statuses thuộc nhóm này
        { $match: { groupId: groupObjectId } },

        // Sắp xếp theo order trước khi project để giữ thứ tự cột Kanban
        { $sort: { order: 1 } },

        // Lookup tasks thuộc status này trong nhóm
        {
          $lookup: {
            from: 'tasks',
            let: { sid: '$_id' },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ['$groupId', groupObjectId] },
                      { $eq: ['$statusId', '$$sid'] },
                    ],
                  },
                },
              },
            ],
            as: 'tasks',
          },
        },

        // Project shape StatusBreakdownRaw — giữ isCompleted cho server-side calc
        {
          $project: {
            _id: 0,
            statusId: { $toString: '$_id' },
            name: 1,
            color: 1,
            isCompleted: 1,
            count: { $size: '$tasks' },
          },
        },
      ]),

      // ── PIPELINE 2: Số tasks quá hạn chưa hoàn thành ─────────────────────────
      this.taskModel.aggregate<{ count: number }>([
        // Tiền lọc nhanh trước khi join: chỉ tasks trong nhóm có deadline đã qua
        // M1 B7: $gt:null thay cho $ne:null — cho phép B-tree dùng single range scan
        {
          $match: {
            groupId: groupObjectId,
            deadline: { $gt: null, $lt: now },
          },
        },

        // Join để kiểm tra isCompleted thông qua status (không hardcode tên status)
        {
          $lookup: {
            from: 'statuses',
            localField: 'statusId',
            foreignField: '_id',
            as: 'status',
          },
        },
        { $unwind: '$status' },

        // Chỉ giữ lại tasks chưa được đánh dấu hoàn thành
        { $match: { 'status.isCompleted': false } },

        { $count: 'count' },
      ]),

      // ── PIPELINE 3: Thống kê tasks theo thành viên ──────────────────────────
      this.groupMemberModel.aggregate<AssigneeStatItem>([
        // Lấy tất cả thành viên trong nhóm (kể cả 0 task)
        { $match: { groupId: groupObjectId } },

        // Populate thông tin user (tên, avatar)
        {
          $lookup: {
            from: 'users',
            localField: 'userId',
            foreignField: '_id',
            as: 'user',
          },
        },
        { $unwind: '$user' },

        // Lookup tasks được giao cho thành viên này trong nhóm,
        // kèm join status để biết task nào đã hoàn thành
        {
          $lookup: {
            from: 'tasks',
            let: { uid: '$userId' },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ['$groupId', groupObjectId] },
                      { $eq: ['$assigneeId', '$$uid'] },
                    ],
                  },
                },
              },
              // Join status của từng task để phân biệt done/total
              {
                $lookup: {
                  from: 'statuses',
                  localField: 'statusId',
                  foreignField: '_id',
                  as: 'status',
                },
              },
              // M2 B7: preserveNullAndEmptyArrays — tránh mất task khi status bị xóa ngoài quy trình
              {
                $unwind: { path: '$status', preserveNullAndEmptyArrays: true },
              },
            ],
            as: 'assignedTasks',
          },
        },

        {
          $project: {
            _id: 0,
            userId: { $toString: '$userId' },
            name: '$user.name',
            avatar: { $ifNull: ['$user.avatar', null] },
            total: { $size: '$assignedTasks' },
            // Đếm tasks được giao đã có status.isCompleted = true
            done: {
              $size: {
                $filter: {
                  input: '$assignedTasks',
                  as: 'task',
                  cond: { $eq: ['$$task.status.isCompleted', true] },
                },
              },
            },
          },
        },

        // Sắp xếp: nhiều task nhất lên đầu, cùng số thì thứ tự alpha theo tên
        { $sort: { total: -1, name: 1 } },
      ]),
    ]);

    // ── Tính toán các chỉ số tổng hợp từ kết quả Pipeline 1 ──────────────────
    const totalTasks = statusRows.reduce((sum, r) => sum + r.count, 0);
    const completedCount = statusRows
      .filter((r) => r.isCompleted)
      .reduce((sum, r) => sum + r.count, 0);

    // Tránh chia 0 khi chưa có task nào; làm tròn 1 chữ số thập phân
    const completionRate =
      totalTasks > 0
        ? Math.round((completedCount / totalTasks) * 1000) / 10
        : 0.0;

    // overdueResult là mảng 1 phần tử hoặc rỗng (khi không có tasks quá hạn)
    const overdueCount = overdueResult[0]?.count ?? 0;

    const statusBreakdown: StatusBreakdownItem[] = statusRows.map(
      ({ statusId, name, color, isCompleted, count }) => ({
        statusId,
        name,
        color,
        isCompleted,
        count,
      }),
    );

    return {
      totalTasks,
      completedTasks: completedCount,
      statusBreakdown,
      overdueCount,
      completionRate,
      tasksByAssignee: assigneeRows,
      recentTasks: [],
      attentionTasks: [],
    };
  }

  // ---------------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------------

  private _normalizeGroupName(name: string): {
    name: string;
    normalized: string;
  } {
    const trimmedName = name.trim();
    if (!trimmedName) {
      throw new BadRequestException('Tên nhóm không được để trống');
    }

    return {
      name: trimmedName,
      normalized: trimmedName.toLowerCase(),
    };
  }

  private _normalizeDescription(description?: string | null): string | null {
    const normalized = description?.trim();
    return normalized ? normalized : null;
  }

  private _normalizeGroupDate(
    value?: string | Date | null,
    fieldName = 'date',
  ): Date | null {
    if (value === undefined || value === null || value === '') {
      return null;
    }

    const normalizedDate = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(normalizedDate.getTime())) {
      throw new BadRequestException(`${fieldName} không hợp lệ`);
    }

    return normalizedDate;
  }

  private _assertValidGroupTimeline(
    startDate: Date | null,
    endDate: Date | null,
  ): void {
    const today = new Date();
    const startOfToday = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate(),
    );

    if (startDate && startDate.getTime() < startOfToday.getTime()) {
      throw new BadRequestException('Ngày bắt đầu không được ở quá khứ');
    }

    if (startDate && endDate && endDate.getTime() < startDate.getTime()) {
      throw new BadRequestException(
        'Ngày kết thúc phải sau hoặc bằng ngày bắt đầu',
      );
    }

    if (!startDate && endDate && endDate.getTime() < startOfToday.getTime()) {
      throw new BadRequestException(
        'Nếu chưa chọn ngày bắt đầu thì ngày kết thúc phải từ hôm nay trở đi',
      );
    }
  }

  private _isSameDate(left: Date | null, right: Date | null): boolean {
    if (!left && !right) {
      return true;
    }

    if (!left || !right) {
      return false;
    }

    return left.getTime() === right.getTime();
  }

  private _normalizeAggregateStatuses(
    statuses?: GroupStatusInputDto[],
  ): AggregateStatusInput[] {
    if (!statuses || statuses.length === 0) {
      throw new BadRequestException(GROUP_ERRORS.STATUS_REQUIRED);
    }

    const seenNames = new Set<string>();
    const seenSlugs = new Set<string>();

    return statuses.map((status, index) => {
      if (status._id && !isValidObjectId(status._id)) {
        throw new BadRequestException('statusId không hợp lệ');
      }

      const trimmedName = status.name.trim();
      const slug = this._toSlug(trimmedName);
      const normalizedName = trimmedName.toLowerCase();

      if (seenNames.has(normalizedName) || seenSlugs.has(slug)) {
        throw new BadRequestException(GROUP_ERRORS.STATUS_DUPLICATE);
      }

      seenNames.add(normalizedName);
      seenSlugs.add(slug);

      return {
        _id: status._id,
        name: trimmedName,
        slug,
        color: status.color ?? '#6B7280',
        order: index + 1,
        isDefault: index === 0,
        isCompleted: status.isCompleted ?? false,
      };
    });
  }

  private _normalizeAggregateLabels(
    labels?: GroupLabelInputDto[],
  ): AggregateLabelInput[] {
    const seenNames = new Set<string>();

    return (labels ?? []).map((label) => {
      if (label._id && !isValidObjectId(label._id)) {
        throw new BadRequestException('labelId không hợp lệ');
      }

      const trimmedName = label.name.trim();
      const normalizedName = trimmedName.toLowerCase();

      if (seenNames.has(normalizedName)) {
        throw new BadRequestException(GROUP_ERRORS.LABEL_DUPLICATE);
      }

      seenNames.add(normalizedName);

      return {
        _id: label._id,
        name: trimmedName,
        color: label.color ?? '#6B7280',
      };
    });
  }

  private _normalizeInviteEmails(inviteEmails?: string[]): string[] {
    const normalizedEmails = [
      ...new Set(
        (inviteEmails ?? [])
          .map((email) => email.trim().toLowerCase())
          .filter(Boolean),
      ),
    ];

    const hasInvalidEmail = normalizedEmails.some(
      (email) => !EMAIL_REGEX.test(email),
    );
    if (hasInvalidEmail) {
      throw new BadRequestException(GROUP_ERRORS.INVITE_EMAIL_INVALID);
    }

    return normalizedEmails;
  }

  private async _ensureGroupNameAvailable(
    nameNormalized: string,
    excludeGroupId?: Types.ObjectId,
    session?: ClientSession,
  ): Promise<void> {
    const query = this.groupModel
      .findOne({
        nameNormalized,
        ...(excludeGroupId ? { _id: { $ne: excludeGroupId } } : {}),
      })
      .select({ _id: 1 });

    if (session) {
      query.session(session);
    }

    const existingGroup = await query.lean().exec();

    if (existingGroup) {
      throw new BadRequestException(GROUP_ERRORS.NAME_ALREADY_EXISTS);
    }
  }

  private async _createGroupRecord(
    data: {
      name: string;
      nameNormalized: string;
      description: string | null;
      startDate: Date | null;
      endDate: Date | null;
      ownerId: Types.ObjectId;
    },
    session?: ClientSession,
  ): Promise<GroupDocument> {
    const [group] = await this.groupModel.create(
      [data],
      session ? { session } : undefined,
    );

    return group;
  }

  private async _insertGroupMembers(
    members: Array<{
      groupId: Types.ObjectId;
      userId: Types.ObjectId;
      role: GroupRole;
      joinedAt: Date;
    }>,
    session?: ClientSession,
  ): Promise<void> {
    if (members.length === 0) {
      return;
    }

    if (session) {
      await this.groupMemberModel.insertMany(members, { session });
      return;
    }

    await this.groupMemberModel.insertMany(members);
  }

  private async _insertStatusesForGroup(
    groupId: Types.ObjectId,
    statuses: AggregateStatusInput[],
    session?: ClientSession,
  ): Promise<void> {
    if (statuses.length === 0) {
      return;
    }

    const documents = statuses.map((status) => ({
      groupId,
      name: status.name,
      slug: status.slug,
      color: status.color,
      order: status.order,
      isDefault: status.isDefault,
      isCompleted: status.isCompleted,
    }));

    if (session) {
      await this.statusModel.insertMany(documents, { session });
      return;
    }

    await this.statusModel.insertMany(documents);
  }

  private async _insertLabelsForGroup(
    groupId: Types.ObjectId,
    labels: AggregateLabelInput[],
    session?: ClientSession,
  ): Promise<void> {
    if (labels.length === 0) {
      return;
    }

    const documents = labels.map((label) => ({
      groupId,
      name: label.name,
      color: label.color,
    }));

    if (session) {
      await this.labelModel.insertMany(documents, { session });
      return;
    }

    await this.labelModel.insertMany(documents);
  }

  private async _createPendingInviteRecords(
    groupId: Types.ObjectId,
    inviteEmails: string[],
    requesterEmail: string,
    session?: ClientSession,
    role: GroupRole = GroupRole.MEMBER,
  ): Promise<PendingInviteRecordInfo[]> {
    if (inviteEmails.length === 0) {
      return [];
    }

    const normalizedRequesterEmail = requesterEmail.trim().toLowerCase();
    const duplicateSelfInvite = inviteEmails.includes(normalizedRequesterEmail);
    if (duplicateSelfInvite) {
      throw new BadRequestException(GROUP_ERRORS.ALREADY_MEMBER);
    }

    const userQuery = this.userModel
      .find({ email: { $in: inviteEmails } })
      .select({ _id: 1, email: 1 });
    if (session) {
      userQuery.session(session);
    }
    const existingUsers = await userQuery.lean().exec();

    if (existingUsers.length > 0) {
      const existingUserIds = existingUsers.map((user) => user._id);
      const memberQuery = this.groupMemberModel
        .find({
          groupId,
          userId: { $in: existingUserIds },
        })
        .select({ userId: 1 });
      if (session) {
        memberQuery.session(session);
      }
      const existingMembers = await memberQuery.lean().exec();

      if (existingMembers.length > 0) {
        throw new BadRequestException(GROUP_ERRORS.ALREADY_MEMBER);
      }
    }

    const expiresAt = new Date(Date.now() + INVITE_TOKEN_TTL_MS);
    await this.groupInviteModel.updateMany(
      {
        groupId,
        email: { $in: inviteEmails },
        status: InviteStatus.PENDING,
      },
      { $set: { status: InviteStatus.EXPIRED } },
      session ? { session } : undefined,
    );

    const inviteRecords = inviteEmails.map((email) => ({
      groupId,
      email,
      inviteToken: randomUUID(),
      role,
      status: InviteStatus.PENDING,
      expiresAt,
    }));

    if (session) {
      await this.groupInviteModel.insertMany(inviteRecords, { session });
    } else {
      await this.groupInviteModel.insertMany(inviteRecords);
    }

    return inviteRecords.map((record) => ({
      email: record.email,
      inviteToken: record.inviteToken,
      role: record.role,
    }));
  }

  private async _sendPendingInviteEmails(
    inviteRecords: PendingInviteRecordInfo[],
    groupName: string,
    inviterId: string,
  ): Promise<InviteSummaryResult> {
    if (inviteRecords.length === 0) {
      return {
        requested: 0,
        sent: 0,
        failedEmails: [],
      };
    }

    const inviter = await this.userModel
      .findById(inviterId)
      .select({ name: 1 })
      .lean()
      .exec();

    const inviterName = inviter?.name ?? 'Một thành viên';
    const frontendUrl =
      this.configService.get<string>('FRONTEND_URL') ?? 'http://localhost:5173';

    const failedEmails: string[] = [];
    let sent = 0;

    await Promise.all(
      inviteRecords.map(async (record) => {
        const inviteUrl = `${frontendUrl}/invite/accept?token=${record.inviteToken}`;
        const emailPayload: GroupInviteEmailPayload = {
          toEmail: record.email,
          groupName,
          inviterName,
          inviteUrl,
        };

        try {
          await this.mailService.sendGroupInviteEmail(emailPayload);
          sent += 1;
        } catch (error) {
          failedEmails.push(record.email);
          await this.groupInviteModel
            .deleteOne({ inviteToken: record.inviteToken })
            .exec()
            .catch((deleteError: unknown) => {
              this.logger.error(
                `Xóa invite lỗi sau khi gửi email thất bại: ${record.inviteToken}`,
                deleteError,
              );
            });

          this.logger.error(
            `Gửi email lời mời thất bại cho ${record.email}`,
            error,
          );
        }
      }),
    );

    return {
      requested: inviteRecords.length,
      sent,
      failedEmails,
    };
  }

  private async _syncAggregateStatuses(
    groupId: Types.ObjectId,
    statuses: AggregateStatusInput[],
    session?: ClientSession,
  ): Promise<void> {
    const statusQuery = this.statusModel.find({ groupId }).sort({ order: 1 });
    if (session) {
      statusQuery.session(session);
    }
    const existingStatuses = await statusQuery.lean().exec();
    const existingStatusMap = new Map(
      existingStatuses.map((status) => [status._id.toString(), status]),
    );

    for (const status of statuses) {
      if (status._id && !existingStatusMap.has(status._id)) {
        throw new NotFoundException(GROUP_ERRORS.STATUS_NOT_FOUND);
      }
    }

    const nextStatusIds = new Set(
      statuses
        .map((status) => status._id)
        .filter((statusId): statusId is string => Boolean(statusId)),
    );
    const removedStatuses = existingStatuses.filter(
      (status) => !nextStatusIds.has(status._id.toString()),
    );

    if (removedStatuses.length > 0) {
      const removedStatusIds = removedStatuses.map((status) => status._id);
      const taskCount = await this.taskModel.countDocuments(
        { groupId, statusId: { $in: removedStatusIds } },
        session ? { session } : undefined,
      );

      if (taskCount > 0) {
        throw new BadRequestException(GROUP_ERRORS.STATUS_HAS_TASKS(taskCount));
      }
    }

    const updateOperations = statuses
      .filter((status): status is AggregateStatusInput & { _id: string } =>
        Boolean(status._id),
      )
      .map((status) =>
        this.statusModel.updateOne(
          { _id: toObjectId(status._id), groupId },
          {
            $set: {
              name: status.name,
              slug: status.slug,
              color: status.color,
              order: status.order,
              isDefault: status.isDefault,
              isCompleted: status.isCompleted,
            },
          },
          session ? { session } : undefined,
        ),
      );

    if (updateOperations.length > 0) {
      await Promise.all(updateOperations);
    }

    const newStatuses = statuses.filter((status) => !status._id);
    if (newStatuses.length > 0) {
      await this._insertStatusesForGroup(groupId, newStatuses, session);
    }

    if (removedStatuses.length > 0) {
      await this.statusModel.deleteMany(
        {
          _id: { $in: removedStatuses.map((status) => status._id) },
          groupId,
        },
        session ? { session } : undefined,
      );
    }
  }

  private async _syncAggregateLabels(
    groupId: Types.ObjectId,
    labels: AggregateLabelInput[],
    session?: ClientSession,
  ): Promise<void> {
    const labelQuery = this.labelModel.find({ groupId }).sort({ name: 1 });
    if (session) {
      labelQuery.session(session);
    }
    const existingLabels = await labelQuery.lean().exec();
    const existingLabelMap = new Map(
      existingLabels.map((label) => [label._id.toString(), label]),
    );

    for (const label of labels) {
      if (label._id && !existingLabelMap.has(label._id)) {
        throw new NotFoundException(GROUP_ERRORS.LABEL_NOT_FOUND);
      }
    }

    const nextLabelIds = new Set(
      labels
        .map((label) => label._id)
        .filter((labelId): labelId is string => Boolean(labelId)),
    );
    const removedLabels = existingLabels.filter(
      (label) => !nextLabelIds.has(label._id.toString()),
    );

    const updateOperations = labels
      .filter((label): label is AggregateLabelInput & { _id: string } =>
        Boolean(label._id),
      )
      .map((label) =>
        this.labelModel.updateOne(
          { _id: toObjectId(label._id), groupId },
          {
            $set: {
              name: label.name,
              color: label.color,
            },
          },
          session ? { session } : undefined,
        ),
      );

    if (updateOperations.length > 0) {
      await Promise.all(updateOperations);
    }

    const newLabels = labels.filter((label) => !label._id);
    if (newLabels.length > 0) {
      await this._insertLabelsForGroup(groupId, newLabels, session);
    }

    if (removedLabels.length > 0) {
      const removedLabelIds = removedLabels.map((label) => label._id);

      await this.taskLabelModel.deleteMany(
        { labelId: { $in: removedLabelIds } },
        session ? { session } : undefined,
      );

      await this.labelModel.deleteMany(
        {
          _id: { $in: removedLabelIds },
          groupId,
        },
        session ? { session } : undefined,
      );
    }
  }

  private async _removeMembersInAggregateUpdate(
    groupId: Types.ObjectId,
    removeMemberUserIds: string[],
    _requesterId: string,
    session?: ClientSession,
  ): Promise<void> {
    if (removeMemberUserIds.length === 0) {
      return;
    }

    const normalizedIds = [...new Set(removeMemberUserIds)];

    if (normalizedIds.some((userId) => !isValidObjectId(userId))) {
      throw new BadRequestException('userId không hợp lệ');
    }

    const targetObjectIds = normalizedIds.map(
      (userId) => toObjectId(userId),
    );
    const groupQuery = this.groupModel.findById(groupId).select({ ownerId: 1 });
    if (session) {
      groupQuery.session(session);
    }
    const group = await groupQuery.lean().exec();

    if (!group) {
      throw new NotFoundException(GROUP_ERRORS.NOT_FOUND);
    }

    if (targetObjectIds.some((userId) => objectIdsEqual(userId, group.ownerId))) {
      throw new BadRequestException(GROUP_ERRORS.CANNOT_REMOVE_OWNER);
    }

    const memberQuery = this.groupMemberModel
      .find({
        groupId,
        userId: { $in: targetObjectIds },
      })
      .select({ userId: 1 });
    if (session) {
      memberQuery.session(session);
    }
    const existingMembers = await memberQuery.lean().exec();

    if (existingMembers.length !== targetObjectIds.length) {
      throw new BadRequestException(GROUP_ERRORS.TARGET_NOT_MEMBER);
    }

    await this.groupMemberModel.deleteMany(
      {
        groupId,
        userId: { $in: targetObjectIds },
      },
      session ? { session } : undefined,
    );

    await this.taskModel.updateMany(
      {
        groupId,
        assigneeId: { $in: targetObjectIds },
      },
      { $set: { assigneeId: null } },
      session ? { session } : undefined,
    );
  }

  private _buildRolePriorityExpression(fieldPath: string) {
    return {
      $switch: {
        branches: [
          {
            case: { $eq: [fieldPath, GroupRole.OWNER] },
            then: 3,
          },
          {
            case: { $eq: [fieldPath, GroupRole.ADMIN] },
            then: 2,
          },
        ],
        default: 1,
      },
    };
  }

  private _buildGroupPermissions(
    viewerRole: GroupRole,
  ): GroupPermissionsResult {
    const isManager =
      viewerRole === GroupRole.OWNER || viewerRole === GroupRole.ADMIN;

    return {
      canEditGroup: isManager,
      canDeleteGroup: viewerRole === GroupRole.OWNER,
      canInviteMembers: isManager,
      canManageMembers: isManager,
      canManageRoles: isManager,
      canManageStatuses: isManager,
      canManageLabels: isManager,
      canCreateTasks: true,
      canManageTasks: true,
    };
  }

  private _rethrowGroupMutationError(
    logMessage: string,
    fallbackMessage: string,
    error: unknown,
  ): never {
    if (
      error instanceof BadRequestException ||
      error instanceof NotFoundException
    ) {
      throw error;
    }

    if (this._isMongoDuplicateKeyError(error, 'nameNormalized')) {
      throw new BadRequestException(GROUP_ERRORS.NAME_ALREADY_EXISTS);
    }

    this.logger.error(logMessage, error);
    throw new InternalServerErrorException(fallbackMessage);
  }

  private _isMongoDuplicateKeyError(error: unknown, field?: string): boolean {
    if (
      !error ||
      typeof error !== 'object' ||
      !('code' in error) ||
      (error as { code?: number }).code !== 11000
    ) {
      return false;
    }

    if (!field) {
      return true;
    }

    const keyPattern = (error as { keyPattern?: Record<string, unknown> })
      .keyPattern;
    if (keyPattern && field in keyPattern) {
      return true;
    }

    const message =
      error instanceof Error
        ? error.message
        : typeof error === 'string'
          ? error
          : '';
    return message.includes(field);
  }

  /**
   * Sinh slug từ tên status.
   * "In Review" → "in-review" | "Đang làm" → "đang-làm"
   * Giữ nguyên ký tự Unicode để slug có nghĩa với tên tiếng Việt.
   */
  private _toSlug(name: string): string {
    return name.trim().toLowerCase().replace(/\s+/g, '-');
  }

  /**
   * Escape chuỗi để dùng an toàn trong RegExp.
   * Tránh injection khi kiểm tra tên nhãn case-insensitive.
   */
  private _escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Tạo regex tìm kiếm case-insensitive an toàn từ input text tự do.
   */
  private _buildSearchRegex(search?: string): RegExp | null {
    const normalized = search?.trim();
    if (!normalized) {
      return null;
    }

    return new RegExp(this._escapeRegex(normalized), 'i');
  }

  /**
   * Map StatusDocument hoặc lean object thành StatusResult.
   * Không trả raw Mongoose document ra ngoài service.
   */
  private _mapStatus(doc: {
    _id: { toString(): string };
    groupId: { toString(): string };
    name: string;
    slug: string;
    color: string;
    order: number;
    isDefault: boolean;
    isCompleted: boolean;
  }): StatusResult {
    return {
      _id: doc._id.toString(),
      groupId: doc.groupId.toString(),
      name: doc.name,
      slug: doc.slug,
      color: doc.color,
      order: doc.order,
      isDefault: doc.isDefault,
      isCompleted: doc.isCompleted,
    };
  }

  /**
   * Map LabelDocument hoặc lean object thành LabelResult.
   * Không trả raw Mongoose document ra ngoài service.
   */
  private _mapLabel(doc: {
    _id: { toString(): string };
    groupId: { toString(): string };
    name: string;
    color: string;
  }): LabelResult {
    return {
      _id: doc._id.toString(),
      groupId: doc.groupId.toString(),
      name: doc.name,
      color: doc.color,
    };
  }

  /**
   * Khởi tạo mongoose ClientSession để bọc nhiều write operations trong transaction.
   * Giữ phương thức này internal — chỉ service gọi.
   */
  private _startSession(): Promise<ClientSession> {
    return this.groupModel.db.startSession();
  }

  /**
   * Chạy callback trong transaction nếu Mongo hỗ trợ, fallback về non-transaction
   * khi đang dùng standalone instance ở local/dev.
   */
  private async _runWithOptionalTransaction<T>(
    operation: (session?: ClientSession) => Promise<T>,
  ): Promise<T> {
    const session = await this._startSession();

    try {
      return await this._runWithExistingSessionFallback(session, operation);
    } finally {
      await session.endSession();
    }
  }

  /**
   * Reuse session đã mở sẵn; retry không kèm transaction nếu server Mongo không hỗ trợ.
   */
  private async _runWithExistingSessionFallback<T>(
    session: ClientSession,
    operation: (session?: ClientSession) => Promise<T>,
  ): Promise<T> {
    try {
      let result!: T;
      await session.withTransaction(async () => {
        result = await operation(session);
      });
      return result;
    } catch (error) {
      if (!this._isTransactionUnsupportedError(error)) {
        throw error;
      }

      this.logger.warn(
        'MongoDB khong ho tro transaction, fallback sang non-transaction mode',
      );

      return operation();
    }
  }

  /**
   * Nhận diện lỗi transaction trên Mongo standalone / non-replica-set.
   */
  private _isTransactionUnsupportedError(error: unknown): boolean {
    if (!(error instanceof Error)) {
      return false;
    }

    return (
      error.message.includes(
        'Transaction numbers are only allowed on a replica set member or mongos',
      ) ||
      error.message.includes('Transaction support is unavailable') ||
      error.message.includes('transactions are not supported')
    );
  }
}
