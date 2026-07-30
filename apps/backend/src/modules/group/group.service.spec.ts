import { BadRequestException } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { Types } from 'mongoose';
import { GroupService } from './group.service';
import { Group } from './schemas/group.schema';
import { GroupMember } from './schemas/group-member.schema';
import { GroupInvite } from './schemas/group-invite.schema';
import { Status } from './schemas/status.schema';
import { Label } from './schemas/label.schema';
import { Task } from '../task/schemas/task.schema';
import { TaskLabel } from '../task/schemas/task-label.schema';
import { User } from '../auth/schemas/user.schema';
import { MailService } from '../../common/mail/mail.service';
import { GROUP_ERRORS } from './group.constants';
import { InviteStatus } from './enums/invite-status.enum';

// ---------------------------------------------------------------------------
// Mock helpers
// ---------------------------------------------------------------------------

/** Builds a .lean().exec() chain that resolves to `value`. */
function leanExec(value: unknown) {
  const exec = jest.fn().mockResolvedValue(value);
  const lean = jest.fn().mockReturnValue({ exec });
  return { lean, exec };
}

/** Builds a .select().lean().exec() chain that resolves to `value`. */
function selectLeanExec(value: unknown) {
  const exec = jest.fn().mockResolvedValue(value);
  const lean = jest.fn().mockReturnValue({ exec });
  const select = jest.fn().mockReturnValue({ lean, exec });
  return { select };
}

/** Builds a .exists().exec() chain that resolves to `value`. */
function existsExec(value: unknown) {
  const exec = jest.fn().mockResolvedValue(value);
  return { exec };
}

/** Builds a mock Mongoose session with withTransaction + endSession. */
function buildMockSession(txImpl?: (fn: () => Promise<void>) => Promise<void>) {
  return {
    withTransaction: jest
      .fn()
      .mockImplementation(txImpl ?? ((fn: () => Promise<void>) => fn())),
    endSession: jest.fn().mockResolvedValue(undefined),
  };
}

// ---------------------------------------------------------------------------
// Model builder factories
// ---------------------------------------------------------------------------

function buildGroupModel() {
  return {
    findById: jest.fn(),
    create: jest.fn(),
    aggregate: jest.fn(),
    db: { startSession: jest.fn() },
  };
}

function buildGroupMemberModel() {
  return {
    exists: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    deleteOne: jest.fn(),
    updateMany: jest.fn(),
    aggregate: jest.fn(),
  };
}

function buildGroupInviteModel() {
  return {
    exists: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    updateOne: jest.fn(),
    deleteOne: jest.fn(),
  };
}

function buildStatusModel() {
  return {
    exists: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    findOneAndUpdate: jest.fn(),
    create: jest.fn(),
    deleteOne: jest.fn(),
    insertMany: jest.fn(),
    aggregate: jest.fn(),
  };
}

function buildLabelModel() {
  return {
    exists: jest.fn(),
    findOne: jest.fn(),
    findOneAndUpdate: jest.fn(),
    create: jest.fn(),
    deleteOne: jest.fn(),
    find: jest.fn(),
  };
}

function buildTaskModel() {
  return {
    countDocuments: jest.fn(),
    updateMany: jest.fn(),
    aggregate: jest.fn(),
  };
}

function buildTaskLabelModel() {
  return {
    deleteMany: jest.fn(),
  };
}

function buildUserModel() {
  return {
    findOne: jest.fn(),
    findById: jest.fn(),
  };
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const GROUP_ID = new Types.ObjectId().toHexString();
const USER_ID = new Types.ObjectId().toHexString();
const TARGET_USER_ID = new Types.ObjectId().toHexString();
const STATUS_ID = new Types.ObjectId().toHexString();
const LABEL_ID = new Types.ObjectId().toHexString();

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('GroupService', () => {
  let service: GroupService;
  let groupModel: ReturnType<typeof buildGroupModel>;
  let groupMemberModel: ReturnType<typeof buildGroupMemberModel>;
  let groupInviteModel: ReturnType<typeof buildGroupInviteModel>;
  let statusModel: ReturnType<typeof buildStatusModel>;
  let labelModel: ReturnType<typeof buildLabelModel>;
  let taskModel: ReturnType<typeof buildTaskModel>;
  let taskLabelModel: ReturnType<typeof buildTaskLabelModel>;
  let userModel: ReturnType<typeof buildUserModel>;
  let mailService: jest.Mocked<Pick<MailService, 'sendGroupInviteEmail'>>;

  beforeEach(async () => {
    groupModel = buildGroupModel();
    groupMemberModel = buildGroupMemberModel();
    groupInviteModel = buildGroupInviteModel();
    statusModel = buildStatusModel();
    labelModel = buildLabelModel();
    taskModel = buildTaskModel();
    taskLabelModel = buildTaskLabelModel();
    userModel = buildUserModel();

    const mockMailService = {
      sendGroupInviteEmail: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GroupService,
        { provide: getModelToken(Group.name), useValue: groupModel },
        {
          provide: getModelToken(GroupMember.name),
          useValue: groupMemberModel,
        },
        {
          provide: getModelToken(GroupInvite.name),
          useValue: groupInviteModel,
        },
        { provide: getModelToken(Status.name), useValue: statusModel },
        { provide: getModelToken(Label.name), useValue: labelModel },
        { provide: getModelToken(Task.name), useValue: taskModel },
        { provide: getModelToken(TaskLabel.name), useValue: taskLabelModel },
        { provide: getModelToken(User.name), useValue: userModel },
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue('http://localhost:5173') },
        },
        { provide: MailService, useValue: mockMailService },
      ],
    }).compile();

    service = module.get<GroupService>(GroupService);
    mailService = mockMailService as jest.Mocked<
      Pick<MailService, 'sendGroupInviteEmail'>
    >;
  });

  afterEach(() => jest.resetAllMocks());

  // -------------------------------------------------------------------------
  // createGroup
  // -------------------------------------------------------------------------

  describe('createGroup', () => {
    it('returns { _id, name, ownerId, createdAt } on success', async () => {
      const fakeGroupId = new Types.ObjectId();
      const now = new Date();
      const fakeGroup = {
        _id: fakeGroupId,
        name: 'Test Group',
        ownerId: new Types.ObjectId(USER_ID),
        createdAt: now,
      };

      const mockSession = buildMockSession();
      groupModel.db.startSession.mockResolvedValue(mockSession);
      groupModel.create.mockResolvedValue([fakeGroup]);
      groupMemberModel.create.mockResolvedValue([{}]);
      statusModel.insertMany.mockResolvedValue([]);

      const result = await service.createGroup({ name: 'Test Group' }, USER_ID);

      expect(result._id).toBe(fakeGroupId.toString());
      expect(result.name).toBe('Test Group');
      expect(result.ownerId).toBe(USER_ID);
    });

    it('seeds 3 default statuses via statusModel.insertMany', async () => {
      const fakeGroupId = new Types.ObjectId();
      const mockSession = buildMockSession();
      groupModel.db.startSession.mockResolvedValue(mockSession);
      groupModel.create.mockResolvedValue([
        {
          _id: fakeGroupId,
          name: 'G',
          ownerId: new Types.ObjectId(USER_ID),
          createdAt: new Date(),
        },
      ]);
      groupMemberModel.create.mockResolvedValue([{}]);
      statusModel.insertMany.mockResolvedValue([]);

      await service.createGroup({ name: 'G' }, USER_ID);

      expect(statusModel.insertMany).toHaveBeenCalledTimes(1);
      const [statuses] = statusModel.insertMany.mock.calls[0] as [
        Array<{ slug: string }>,
      ];
      expect(statuses.map((s) => s.slug)).toEqual(['todo', 'doing', 'done']);
    });
  });

  // -------------------------------------------------------------------------
  // inviteMember
  // -------------------------------------------------------------------------

  describe('inviteMember', () => {
    const dto = { email: 'newuser@example.com' };
    const invitedUserId = new Types.ObjectId();

    it('throws ALREADY_MEMBER when email is already a member', async () => {
      userModel.findOne.mockReturnValue({
        select: () => leanExec({ _id: invitedUserId }),
      });
      groupMemberModel.exists.mockReturnValue(existsExec(true));

      await expect(
        service.inviteMember(GROUP_ID, dto, USER_ID),
      ).rejects.toThrow(GROUP_ERRORS.ALREADY_MEMBER);
    });

    it('throws INVITE_ALREADY_SENT when pending invite exists', async () => {
      userModel.findOne.mockReturnValue({
        select: () => leanExec(null),
      });
      groupInviteModel.exists.mockReturnValue(existsExec(true));

      await expect(
        service.inviteMember(GROUP_ID, dto, USER_ID),
      ).rejects.toThrow(GROUP_ERRORS.INVITE_ALREADY_SENT);
    });

    it('calls sendGroupInviteEmail on success', async () => {
      userModel.findOne.mockReturnValue({ select: () => leanExec(null) });
      groupInviteModel.exists.mockReturnValue(existsExec(null));
      groupModel.findById.mockReturnValue(selectLeanExec({ name: 'MyGroup' }));
      userModel.findById.mockReturnValue(selectLeanExec({ name: 'Inviter' }));
      groupInviteModel.create.mockResolvedValue({});

      await service.inviteMember(GROUP_ID, dto, USER_ID);

      expect(mailService.sendGroupInviteEmail).toHaveBeenCalledTimes(1);
      const payload = mailService.sendGroupInviteEmail.mock.calls[0][0];
      expect(payload.toEmail).toBe('newuser@example.com');
      expect(payload.groupName).toBe('MyGroup');
    });

    it('performs compensating delete when email send fails', async () => {
      userModel.findOne.mockReturnValue({ select: () => leanExec(null) });
      groupInviteModel.exists.mockReturnValue(existsExec(null));
      groupModel.findById.mockReturnValue(selectLeanExec({ name: 'G' }));
      userModel.findById.mockReturnValue(selectLeanExec({ name: 'I' }));
      groupInviteModel.create.mockResolvedValue({});
      mailService.sendGroupInviteEmail.mockRejectedValue(
        new Error('SMTP error'),
      );
      const deleteOneChain = { exec: jest.fn().mockResolvedValue({}) };
      const deleteOneMock = jest.fn().mockReturnValue(deleteOneChain);
      groupInviteModel.deleteOne = deleteOneMock;

      await expect(
        service.inviteMember(GROUP_ID, dto, USER_ID),
      ).rejects.toThrow();

      expect(deleteOneMock).toHaveBeenCalledTimes(1);
    });
  });

  // -------------------------------------------------------------------------
  // acceptInvite
  // -------------------------------------------------------------------------

  describe('acceptInvite', () => {
    const userEmail = 'user@example.com';
    const validInvite = {
      _id: new Types.ObjectId(),
      inviteToken: 'valid-token',
      email: userEmail,
      status: InviteStatus.PENDING,
      expiresAt: new Date(Date.now() + 86400000),
      groupId: new Types.ObjectId(GROUP_ID),
    };

    it('throws INVITE_INVALID_TOKEN when token not found', async () => {
      groupInviteModel.findOne.mockReturnValue(leanExec(null));

      await expect(
        service.acceptInvite({ token: 'bad-token' }, USER_ID, userEmail),
      ).rejects.toThrow(GROUP_ERRORS.INVITE_INVALID_TOKEN);
    });

    it('throws INVITE_INVALID_TOKEN when email does not match', async () => {
      groupInviteModel.findOne.mockReturnValue(leanExec(validInvite));

      await expect(
        service.acceptInvite(
          { token: 'valid-token' },
          USER_ID,
          'other@test.com',
        ),
      ).rejects.toThrow(GROUP_ERRORS.INVITE_INVALID_TOKEN);
    });

    it('throws INVITE_EXPIRED when status is not PENDING', async () => {
      groupInviteModel.findOne.mockReturnValue(
        leanExec({ ...validInvite, status: InviteStatus.ACCEPTED }),
      );

      await expect(
        service.acceptInvite({ token: 'valid-token' }, USER_ID, userEmail),
      ).rejects.toThrow(GROUP_ERRORS.INVITE_EXPIRED);
    });

    it('throws INVITE_EXPIRED when expiresAt is in the past', async () => {
      groupInviteModel.findOne.mockReturnValue(
        leanExec({
          ...validInvite,
          expiresAt: new Date(Date.now() - 1000),
        }),
      );

      await expect(
        service.acceptInvite({ token: 'valid-token' }, USER_ID, userEmail),
      ).rejects.toThrow(GROUP_ERRORS.INVITE_EXPIRED);
    });

    it('throws ALREADY_MEMBER when user is already in the group', async () => {
      groupInviteModel.findOne.mockReturnValue(leanExec(validInvite));
      groupMemberModel.exists.mockReturnValue(existsExec(true));

      await expect(
        service.acceptInvite({ token: 'valid-token' }, USER_ID, userEmail),
      ).rejects.toThrow(GROUP_ERRORS.ALREADY_MEMBER);
    });

    it('returns { groupId, groupName } on success', async () => {
      groupInviteModel.findOne.mockReturnValue(leanExec(validInvite));
      groupMemberModel.exists.mockReturnValue(existsExec(null));

      const mockSession = buildMockSession();
      groupModel.db.startSession.mockResolvedValue(mockSession);
      groupMemberModel.create.mockResolvedValue([{}]);
      groupInviteModel.updateOne.mockResolvedValue({});
      groupModel.findById.mockReturnValue({
        select: () => ({
          lean: () => ({
            session: () => ({
              exec: jest.fn().mockResolvedValue({ name: 'TestGroup' }),
            }),
          }),
        }),
      });

      const result = await service.acceptInvite(
        { token: 'valid-token' },
        USER_ID,
        userEmail,
      );

      expect(result.groupId).toBe(GROUP_ID);
      expect(result.groupName).toBe('TestGroup');
    });
  });

  // -------------------------------------------------------------------------
  // removeMember
  // -------------------------------------------------------------------------

  describe('removeMember', () => {
    it('throws BadRequestException for invalid userId format', async () => {
      await expect(
        service.removeMember(GROUP_ID, 'not-an-objectid', USER_ID),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws CANNOT_REMOVE_OWNER when target equals requester', async () => {
      await expect(
        service.removeMember(GROUP_ID, USER_ID, USER_ID),
      ).rejects.toThrow(GROUP_ERRORS.CANNOT_REMOVE_OWNER);
    });

    it('throws TARGET_NOT_MEMBER when not in group', async () => {
      groupMemberModel.findOne.mockReturnValue(selectLeanExec(null));

      await expect(
        service.removeMember(GROUP_ID, TARGET_USER_ID, USER_ID),
      ).rejects.toThrow(GROUP_ERRORS.TARGET_NOT_MEMBER);
    });

    it('calls deleteOne (membership) + updateMany (unassign tasks) on success', async () => {
      const memberDoc = { _id: new Types.ObjectId() };
      groupMemberModel.findOne.mockReturnValue(selectLeanExec(memberDoc));

      const mockSession = buildMockSession();
      groupModel.db.startSession.mockResolvedValue(mockSession);
      groupMemberModel.deleteOne.mockResolvedValue({});
      taskModel.updateMany.mockResolvedValue({});

      await service.removeMember(GROUP_ID, TARGET_USER_ID, USER_ID);

      expect(groupMemberModel.deleteOne).toHaveBeenCalledTimes(1);
      expect(taskModel.updateMany).toHaveBeenCalledTimes(1);
    });
  });

  // -------------------------------------------------------------------------
  // deleteStatus
  // -------------------------------------------------------------------------

  describe('deleteStatus', () => {
    it('throws BadRequestException for invalid statusId format', async () => {
      await expect(service.deleteStatus(GROUP_ID, 'bad-id')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws STATUS_NOT_FOUND when status not in group', async () => {
      statusModel.findOne.mockReturnValue(selectLeanExec(null));

      await expect(service.deleteStatus(GROUP_ID, STATUS_ID)).rejects.toThrow(
        GROUP_ERRORS.STATUS_NOT_FOUND,
      );
    });

    it('throws STATUS_CANNOT_DELETE_DEFAULT when isDefault=true', async () => {
      statusModel.findOne.mockReturnValue(
        selectLeanExec({ _id: new Types.ObjectId(STATUS_ID), isDefault: true }),
      );

      await expect(service.deleteStatus(GROUP_ID, STATUS_ID)).rejects.toThrow(
        GROUP_ERRORS.STATUS_CANNOT_DELETE_DEFAULT,
      );
    });

    it('throws STATUS_HAS_TASKS when tasks > 0 (inside transaction)', async () => {
      statusModel.findOne.mockReturnValue(
        selectLeanExec({
          _id: new Types.ObjectId(STATUS_ID),
          isDefault: false,
        }),
      );
      const mockSession = buildMockSession((fn) => fn());
      groupModel.db.startSession.mockResolvedValue(mockSession);
      taskModel.countDocuments.mockResolvedValue(3);

      await expect(service.deleteStatus(GROUP_ID, STATUS_ID)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('calls statusModel.deleteOne on success', async () => {
      statusModel.findOne.mockReturnValue(
        selectLeanExec({
          _id: new Types.ObjectId(STATUS_ID),
          isDefault: false,
        }),
      );
      const mockSession = buildMockSession((fn) => fn());
      groupModel.db.startSession.mockResolvedValue(mockSession);
      taskModel.countDocuments.mockResolvedValue(0);
      statusModel.deleteOne.mockResolvedValue({ deletedCount: 1 });

      await service.deleteStatus(GROUP_ID, STATUS_ID);

      expect(statusModel.deleteOne).toHaveBeenCalledTimes(1);
    });
  });

  // -------------------------------------------------------------------------
  // createStatus
  // -------------------------------------------------------------------------

  describe('createStatus', () => {
    it('throws BadRequestException when slug already exists in group', async () => {
      statusModel.exists.mockReturnValue(existsExec(true));

      await expect(
        service.createStatus(GROUP_ID, { name: 'Todo' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // -------------------------------------------------------------------------
  // deleteLabel
  // -------------------------------------------------------------------------

  describe('deleteLabel', () => {
    it('throws BadRequestException for invalid labelId format', async () => {
      await expect(service.deleteLabel(GROUP_ID, 'not-an-id')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws LABEL_NOT_FOUND when label not in group', async () => {
      labelModel.findOne.mockReturnValue(selectLeanExec(null));

      await expect(service.deleteLabel(GROUP_ID, LABEL_ID)).rejects.toThrow(
        GROUP_ERRORS.LABEL_NOT_FOUND,
      );
    });

    it('calls taskLabelModel.deleteMany + labelModel.deleteOne on success', async () => {
      labelModel.findOne.mockReturnValue(
        selectLeanExec({ _id: new Types.ObjectId(LABEL_ID) }),
      );
      const mockSession = buildMockSession((fn) => fn());
      groupModel.db.startSession.mockResolvedValue(mockSession);
      taskLabelModel.deleteMany.mockResolvedValue({});
      labelModel.deleteOne.mockResolvedValue({ deletedCount: 1 });

      await service.deleteLabel(GROUP_ID, LABEL_ID);

      expect(taskLabelModel.deleteMany).toHaveBeenCalledTimes(1);
      expect(labelModel.deleteOne).toHaveBeenCalledTimes(1);
    });
  });

  // -------------------------------------------------------------------------
  // createLabel
  // -------------------------------------------------------------------------

  describe('createLabel', () => {
    it('throws BadRequestException when label name conflicts (case-insensitive)', async () => {
      labelModel.exists.mockReturnValue(existsExec(true));

      await expect(
        service.createLabel(GROUP_ID, { name: 'bug' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // -------------------------------------------------------------------------
  // getDashboard
  // -------------------------------------------------------------------------

  describe('getDashboard', () => {
    it('calls 3 aggregate pipelines in parallel', async () => {
      groupMemberModel.aggregate.mockResolvedValue([]);
      taskModel.aggregate.mockResolvedValue([]);
      statusModel.aggregate.mockResolvedValue([]);

      await service.getDashboard(GROUP_ID);

      // Pipeline 1: statusModel (status breakdown with zero-count preservation)
      expect(statusModel.aggregate).toHaveBeenCalledTimes(1);
      // Pipeline 2: taskModel (overdue count)
      expect(taskModel.aggregate).toHaveBeenCalledTimes(1);
      // Pipeline 3: groupMemberModel (tasks by assignee)
      expect(groupMemberModel.aggregate).toHaveBeenCalledTimes(1);
    });

    it('returns completionRate 0 when no tasks exist', async () => {
      statusModel.aggregate.mockResolvedValue([]);
      taskModel.aggregate.mockResolvedValue([]);
      groupMemberModel.aggregate.mockResolvedValue([]);

      const result = await service.getDashboard(GROUP_ID);

      expect(result.completionRate).toBe(0);
      expect(result.totalTasks).toBe(0);
    });
  });
});
