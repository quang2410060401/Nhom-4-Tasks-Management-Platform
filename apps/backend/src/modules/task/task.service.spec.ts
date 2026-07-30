import {
  BadRequestException,
  ForbiddenException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { Types } from 'mongoose';
import { TaskService } from './task.service';
import { Task } from './schemas/task.schema';
import { TaskLabel } from './schemas/task-label.schema';
import { TaskComment } from './schemas/task-comment.schema';
import { TaskAttachment } from './schemas/task-attachment.schema';
import { Status } from '../group/schemas/status.schema';
import { Label } from '../group/schemas/label.schema';
import { GroupMember } from '../group/schemas/group-member.schema';
import { User } from '../auth/schemas/user.schema';
import { GroupRole } from '../group/enums/group-role.enum';
import { TaskFileStorageService } from './services/task-file-storage.service';

// ---------------------------------------------------------------------------
// Mock helpers — match the pattern used in group.service.spec.ts
// ---------------------------------------------------------------------------

/** .lean().exec() chain */
function leanExec(value: unknown) {
  const exec = jest.fn().mockResolvedValue(value);
  return { lean: jest.fn().mockReturnValue({ exec }), exec };
}

/** .select().lean().exec() chain */
function selectLeanExec(value: unknown) {
  const exec = jest.fn().mockResolvedValue(value);
  const lean = jest.fn().mockReturnValue({ exec });
  return { select: jest.fn().mockReturnValue({ lean, exec }) };
}

/** .exec() chain (for distinct, exists) */
function execOnly(value: unknown) {
  return { exec: jest.fn().mockResolvedValue(value) };
}

/** Mongoose session mock */
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

function buildTaskModel() {
  return {
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn(),
    updateOne: jest.fn(),
    deleteOne: jest.fn(),
    db: { startSession: jest.fn() },
  };
}

function buildTaskLabelModel() {
  return {
    find: jest.fn(),
    insertMany: jest.fn(),
    deleteMany: jest.fn(),
    distinct: jest.fn(),
  };
}

function buildTaskCommentModel() {
  return {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    updateOne: jest.fn(),
    deleteOne: jest.fn(),
    deleteMany: jest.fn(),
    countDocuments: jest.fn(),
  };
}

function buildTaskAttachmentModel() {
  return {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    deleteOne: jest.fn(),
    deleteMany: jest.fn(),
    countDocuments: jest.fn(),
  };
}

function buildStatusModel() {
  return {
    findOne: jest.fn(),
    findById: jest.fn(),
    find: jest.fn(),
    distinct: jest.fn(),
  };
}

function buildLabelModel() {
  return {
    find: jest.fn(),
  };
}

function buildGroupMemberModel() {
  return {
    exists: jest.fn(),
    findOne: jest.fn(),
  };
}

function buildUserModel() {
  return {
    findById: jest.fn(),
    find: jest.fn(),
  };
}

function buildTaskFileStorageService() {
  return {
    saveAttachmentFiles: jest.fn(),
    removeAttachmentFile: jest.fn(),
    removeTaskDirectory: jest.fn(),
    deleteTaskDirectory: jest.fn(),
    getAttachmentPath: jest.fn(),
  };
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const GROUP_ID = new Types.ObjectId().toHexString();
const TASK_ID = new Types.ObjectId().toHexString();
const USER_ID = new Types.ObjectId().toHexString();
const ASSIGNEE_ID = new Types.ObjectId().toHexString();
const STATUS_ID = new Types.ObjectId().toHexString();
const LABEL_ID = new Types.ObjectId().toHexString();

const mockStatus = {
  _id: new Types.ObjectId(STATUS_ID),
  name: 'Todo',
  color: '#3B82F6',
  isDefault: true,
  isCompleted: false,
};

const mockTask = {
  _id: new Types.ObjectId(TASK_ID),
  title: 'Test Task',
  description: null,
  groupId: new Types.ObjectId(GROUP_ID),
  statusId: new Types.ObjectId(STATUS_ID),
  assigneeId: null,
  creatorId: new Types.ObjectId(USER_ID),
  deadline: null,
  reminderSentAt: null,
  overdueSentAt: null,
  createdAt: new Date('2025-01-01'),
  updatedAt: new Date('2025-01-01'),
};

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('TaskService', () => {
  let service: TaskService;
  let taskModel: ReturnType<typeof buildTaskModel>;
  let taskLabelModel: ReturnType<typeof buildTaskLabelModel>;
  let taskCommentModel: ReturnType<typeof buildTaskCommentModel>;
  let taskAttachmentModel: ReturnType<typeof buildTaskAttachmentModel>;
  let statusModel: ReturnType<typeof buildStatusModel>;
  let labelModel: ReturnType<typeof buildLabelModel>;
  let groupMemberModel: ReturnType<typeof buildGroupMemberModel>;
  let userModel: ReturnType<typeof buildUserModel>;
  let taskFileStorageService: ReturnType<typeof buildTaskFileStorageService>;

  beforeEach(async () => {
    taskModel = buildTaskModel();
    taskLabelModel = buildTaskLabelModel();
    taskCommentModel = buildTaskCommentModel();
    taskAttachmentModel = buildTaskAttachmentModel();
    statusModel = buildStatusModel();
    labelModel = buildLabelModel();
    groupMemberModel = buildGroupMemberModel();
    userModel = buildUserModel();
    taskFileStorageService = buildTaskFileStorageService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TaskService,
        { provide: getModelToken(Task.name), useValue: taskModel },
        { provide: getModelToken(TaskLabel.name), useValue: taskLabelModel },
        {
          provide: getModelToken(TaskComment.name),
          useValue: taskCommentModel,
        },
        {
          provide: getModelToken(TaskAttachment.name),
          useValue: taskAttachmentModel,
        },
        { provide: getModelToken(Status.name), useValue: statusModel },
        { provide: getModelToken(Label.name), useValue: labelModel },
        {
          provide: getModelToken(GroupMember.name),
          useValue: groupMemberModel,
        },
        { provide: getModelToken(User.name), useValue: userModel },
        { provide: TaskFileStorageService, useValue: taskFileStorageService },
      ],
    }).compile();

    service = module.get<TaskService>(TaskService);
  });

  afterEach(() => jest.resetAllMocks());

  // =========================================================================
  // createTask
  // =========================================================================

  describe('createTask', () => {
    const dto = { title: 'Test Task', labelIds: [] };

    function setupHappyPath() {
      // statusModel.findOne → default status
      statusModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockStatus),
      });

      // taskModel session + transaction
      const session = buildMockSession();
      taskModel.db.startSession.mockResolvedValue(session);

      // taskModel.create inside transaction
      const createdDoc = {
        ...mockTask,
        title: dto.title,
        createdAt: new Date(),
      };
      taskModel.create.mockResolvedValue([createdDoc]);
      taskLabelModel.insertMany.mockResolvedValue([]);

      return { session, createdDoc };
    }

    it('should create a task and return CreateTaskResult', async () => {
      setupHappyPath();

      const result = await service.createTask(GROUP_ID, dto, USER_ID);

      expect(result).toMatchObject({
        title: dto.title,
        groupId: GROUP_ID,
        creatorId: USER_ID,
        assigneeId: null,
        assignee: null,
        labels: [],
      });
      expect(result.status._id).toBe(STATUS_ID);
      expect(taskModel.create).toHaveBeenCalledTimes(1);
    });

    it('should throw NotFoundException if groupId is not a valid ObjectId', async () => {
      await expect(
        service.createTask('not-a-valid-id', dto, USER_ID),
      ).rejects.toThrow(NotFoundException);
    });

    it('should use the default status when statusId is not provided', async () => {
      setupHappyPath();
      await service.createTask(
        GROUP_ID,
        { ...dto, statusId: undefined },
        USER_ID,
      );
      expect(statusModel.findOne).toHaveBeenCalledWith(
        expect.objectContaining({ isDefault: true }),
      );
    });

    it('should throw BadRequestException when default status does not exist', async () => {
      statusModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(service.createTask(GROUP_ID, dto, USER_ID)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.createTask(GROUP_ID, dto, USER_ID)).rejects.toThrow(
        'Nhóm chưa có status mặc định',
      );
    });

    it('should throw BadRequestException when statusId does not belong to group', async () => {
      // When a specific statusId is given but not found in the group
      statusModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(
        service.createTask(
          GROUP_ID,
          { ...dto, statusId: new Types.ObjectId().toHexString() },
          USER_ID,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when deadline is in the past', async () => {
      setupHappyPath();
      const pastDeadline = new Date(Date.now() - 60_000).toISOString();

      await expect(
        service.createTask(
          GROUP_ID,
          { ...dto, deadline: pastDeadline },
          USER_ID,
        ),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.createTask(
          GROUP_ID,
          { ...dto, deadline: pastDeadline },
          USER_ID,
        ),
      ).rejects.toThrow('Hạn hoàn thành');
    });

    it('should throw BadRequestException when assigneeId is not a group member', async () => {
      setupHappyPath();

      // groupMemberModel.exists → null (not a member)
      groupMemberModel.exists.mockReturnValue(execOnly(null));
      userModel.findById.mockReturnValue(
        selectLeanExec({
          _id: new Types.ObjectId(ASSIGNEE_ID),
          name: 'User',
          avatar: null,
        }),
      );

      await expect(
        service.createTask(
          GROUP_ID,
          { ...dto, assigneeId: ASSIGNEE_ID },
          USER_ID,
        ),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.createTask(
          GROUP_ID,
          { ...dto, assigneeId: ASSIGNEE_ID },
          USER_ID,
        ),
      ).rejects.toThrow('Người được giao');
    });

    it('should throw BadRequestException when a labelId does not belong to the group', async () => {
      setupHappyPath();
      const labelId = new Types.ObjectId().toHexString();

      // labelModel returns fewer labels than requested → reject
      labelModel.find.mockReturnValue({
        select: jest.fn().mockReturnValue(leanExec([])),
      });

      await expect(
        service.createTask(GROUP_ID, { ...dto, labelIds: [labelId] }, USER_ID),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw InternalServerErrorException when transaction fails', async () => {
      statusModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockStatus),
      });
      const session = buildMockSession(() => {
        throw new Error('DB error');
      });
      taskModel.db.startSession.mockResolvedValue(session);

      await expect(service.createTask(GROUP_ID, dto, USER_ID)).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  // =========================================================================
  // getTaskDetail
  // =========================================================================

  describe('getTaskDetail', () => {
    function setupTaskDetailMocks() {
      taskModel.findOne.mockReturnValue(leanExec(mockTask));
      statusModel.findById.mockReturnValue(selectLeanExec(mockStatus));
      userModel.findById.mockReturnValue(
        selectLeanExec({
          _id: new Types.ObjectId(USER_ID),
          name: 'Creator',
          avatar: null,
        }),
      );
      taskLabelModel.find.mockReturnValue(leanExec([]));
    }

    it('should return full task detail when task exists', async () => {
      setupTaskDetailMocks();

      const result = await service.getTaskDetail(GROUP_ID, TASK_ID);

      expect(result._id).toBe(TASK_ID);
      expect(result.title).toBe(mockTask.title);
      expect(result.status._id).toBe(STATUS_ID);
      expect(result.assignee).toBeNull();
      expect(result.labels).toEqual([]);
    });

    it('should throw NotFoundException when taskId is an invalid ObjectId', async () => {
      await expect(service.getTaskDetail(GROUP_ID, 'bad-id')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException when groupId is an invalid ObjectId', async () => {
      await expect(
        service.getTaskDetail('bad-group-id', TASK_ID),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when task does not belong to group', async () => {
      taskModel.findOne.mockReturnValue(leanExec(null));

      await expect(service.getTaskDetail(GROUP_ID, TASK_ID)).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.getTaskDetail(GROUP_ID, TASK_ID)).rejects.toThrow(
        'Task không tồn tại',
      );
    });

    it('should populate labels when task has labels', async () => {
      const labelObjId = new Types.ObjectId(LABEL_ID);
      const taskWithLabel = {
        ...mockTask,
        labelIds: [labelObjId],
      };
      taskModel.findOne.mockReturnValue(leanExec(taskWithLabel));
      statusModel.findById.mockReturnValue(selectLeanExec(mockStatus));
      userModel.findById.mockReturnValue(
        selectLeanExec({
          _id: new Types.ObjectId(USER_ID),
          name: 'Creator',
          avatar: null,
        }),
      );
      taskLabelModel.find.mockReturnValue(
        leanExec([{ taskId: mockTask._id, labelId: labelObjId }]),
      );
      labelModel.find.mockReturnValue(
        selectLeanExec([{ _id: labelObjId, name: 'Bug', color: '#EF4444' }]),
      );

      const result = await service.getTaskDetail(GROUP_ID, TASK_ID);

      expect(result.labels).toHaveLength(1);
      expect(result.labels[0].name).toBe('Bug');
    });
  });

  // =========================================================================
  // getKanbanTasks
  // =========================================================================

  describe('getKanbanTasks', () => {
    const mockStatusList = [
      {
        _id: new Types.ObjectId(STATUS_ID),
        name: 'Todo',
        slug: 'todo',
        color: '#3B82F6',
        order: 1,
      },
    ];

    it('should return a board with empty statuses when no tasks match', async () => {
      statusModel.find.mockReturnValue({
        sort: jest.fn().mockReturnValue(leanExec(mockStatusList)),
      });
      taskModel.find.mockReturnValue({
        sort: jest.fn().mockReturnValue(leanExec([])),
      });

      const result = await service.getKanbanTasks(GROUP_ID, {});

      expect(result.statuses).toHaveLength(1);
      expect(result.statuses[0].tasks).toHaveLength(0);
    });

    it('should return empty statuses array for invalid groupId', async () => {
      const result = await service.getKanbanTasks('bad-id', {});
      expect(result.statuses).toEqual([]);
    });

    it('should group tasks under their matching status bucket', async () => {
      statusModel.find.mockReturnValue({
        sort: jest.fn().mockReturnValue(leanExec(mockStatusList)),
      });

      const taskInStatus = {
        ...mockTask,
        statusId: new Types.ObjectId(STATUS_ID),
        createdAt: new Date(),
      };
      taskModel.find.mockReturnValue({
        sort: jest.fn().mockReturnValue(leanExec([taskInStatus])),
      });
      taskLabelModel.find.mockReturnValue(leanExec([]));
      userModel.find.mockReturnValue(selectLeanExec([]));

      const result = await service.getKanbanTasks(GROUP_ID, {});

      expect(result.statuses[0].tasks).toHaveLength(1);
      expect(result.statuses[0].tasks[0].title).toBe(mockTask.title);
    });

    it('should apply search filter with regex-escaped characters', async () => {
      statusModel.find.mockReturnValue({
        sort: jest.fn().mockReturnValue(leanExec(mockStatusList)),
      });
      const findSpy = jest
        .fn()
        .mockReturnValue({ sort: jest.fn().mockReturnValue(leanExec([])) });
      taskModel.find = findSpy;

      await service.getKanbanTasks(GROUP_ID, { search: 'test.query' });

      const [[calledFilter]] = findSpy.mock.calls as [
        [Record<string, Record<string, unknown>>],
      ];
      expect(calledFilter.title.$regex).toBe('test\\.query');
    });

    it('should apply assigneeId filter', async () => {
      statusModel.find.mockReturnValue({
        sort: jest.fn().mockReturnValue(leanExec(mockStatusList)),
      });
      const findSpy = jest
        .fn()
        .mockReturnValue({ sort: jest.fn().mockReturnValue(leanExec([])) });
      taskModel.find = findSpy;

      await service.getKanbanTasks(GROUP_ID, { assigneeId: ASSIGNEE_ID });

      const [[calledFilter]] = findSpy.mock.calls as [
        [Record<string, { toString(): string }>],
      ];
      expect(calledFilter.assigneeId.toString()).toBe(ASSIGNEE_ID);
    });
  });

  // =========================================================================
  // updateTask
  // =========================================================================

  describe('updateTask', () => {
    function setupUpdateMocks(existingTask = mockTask) {
      taskModel.findOne.mockReturnValue(leanExec(existingTask));
      taskModel.updateOne.mockResolvedValue({ modifiedCount: 1 });
      // For getTaskDetail re-fetch
      statusModel.findById.mockReturnValue(selectLeanExec(mockStatus));
      userModel.findById.mockReturnValue(
        selectLeanExec({
          _id: new Types.ObjectId(USER_ID),
          name: 'User',
          avatar: null,
        }),
      );
      taskLabelModel.find.mockReturnValue(leanExec([]));
    }

    it('should throw NotFoundException for invalid taskId', async () => {
      await expect(
        service.updateTask(GROUP_ID, 'bad-id', { title: 'New' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException for invalid groupId', async () => {
      await expect(
        service.updateTask('bad-group', TASK_ID, { title: 'New' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when task does not exist', async () => {
      taskModel.findOne.mockReturnValue(leanExec(null));

      await expect(
        service.updateTask(GROUP_ID, TASK_ID, { title: 'New' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should update title without requiring a transaction', async () => {
      setupUpdateMocks();
      taskModel.findOne
        .mockReturnValueOnce(leanExec(mockTask)) // initial load
        .mockReturnValueOnce(leanExec(mockTask)); // getTaskDetail re-fetch

      await service.updateTask(GROUP_ID, TASK_ID, { title: 'Updated' });

      expect(taskModel.updateOne).toHaveBeenCalledWith(
        expect.objectContaining({ _id: expect.any(Types.ObjectId) as unknown }),
        expect.objectContaining({
          $set: expect.objectContaining({ title: 'Updated' }) as unknown,
        }),
      );
      // No transaction for field-only update
      expect(taskModel.db.startSession).not.toHaveBeenCalled();
    });

    it('should use a transaction when labelIds are changed', async () => {
      setupUpdateMocks();
      taskModel.findOne
        .mockReturnValueOnce(leanExec(mockTask))
        .mockReturnValueOnce(leanExec(mockTask));

      const session = buildMockSession();
      taskModel.db.startSession.mockResolvedValue(session);
      taskLabelModel.deleteMany.mockResolvedValue({});
      taskLabelModel.insertMany.mockResolvedValue([]);

      // Label validation
      labelModel.find.mockReturnValue({
        select: jest.fn().mockReturnValue(
          leanExec([
            {
              _id: new Types.ObjectId(LABEL_ID),
              name: 'Bug',
              color: '#EF4444',
            },
          ]),
        ),
      });

      await service.updateTask(GROUP_ID, TASK_ID, { labelIds: [LABEL_ID] });

      expect(taskModel.db.startSession).toHaveBeenCalled();
      expect(taskLabelModel.deleteMany).toHaveBeenCalled();
      expect(taskLabelModel.insertMany).toHaveBeenCalled();
    });

    it('should reset notification flags when status changes from completed to incomplete', async () => {
      const completedStatusId = new Types.ObjectId();
      const taskInCompleted = {
        ...mockTask,
        statusId: completedStatusId,
      };

      taskModel.findOne
        .mockReturnValueOnce(leanExec(taskInCompleted))
        .mockReturnValueOnce(leanExec(taskInCompleted));

      // old status → isCompleted = true
      const completedStatus = { _id: completedStatusId, isCompleted: true };
      // new status → isCompleted = false
      const newIncompleteStatus = {
        _id: new Types.ObjectId(STATUS_ID),
        name: 'Todo',
        color: '#3B82F6',
        isCompleted: false,
      };

      statusModel.findById
        .mockReturnValueOnce(selectLeanExec(completedStatus)) // oldStatus in updateTask
        .mockReturnValueOnce(selectLeanExec(newIncompleteStatus)); // getTaskDetail re-fetch

      statusModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(newIncompleteStatus),
      });

      userModel.findById.mockReturnValue(
        selectLeanExec({
          _id: new Types.ObjectId(USER_ID),
          name: 'User',
          avatar: null,
        }),
      );
      taskLabelModel.find.mockReturnValue(leanExec([]));
      taskModel.updateOne.mockResolvedValue({ modifiedCount: 1 });

      await service.updateTask(GROUP_ID, TASK_ID, {
        statusId: STATUS_ID,
      });

      const [, updateArg] = taskModel.updateOne.mock.calls[0] as [
        unknown,
        { $set: Record<string, unknown> },
      ];
      const $set = updateArg.$set;
      expect($set.reminderSentAt).toBeNull();
      expect($set.overdueSentAt).toBeNull();
    });

    it('should reset notification flags when deadline changes on an incomplete task', async () => {
      taskModel.findOne
        .mockReturnValueOnce(leanExec(mockTask))
        .mockReturnValueOnce(leanExec(mockTask));

      statusModel.findById.mockReturnValue(
        selectLeanExec({
          _id: new Types.ObjectId(STATUS_ID),
          name: 'Todo',
          color: '#3B82F6',
          isCompleted: false,
        }),
      );
      statusModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockStatus),
      });
      userModel.findById.mockReturnValue(
        selectLeanExec({
          _id: new Types.ObjectId(USER_ID),
          name: 'User',
          avatar: null,
        }),
      );
      taskLabelModel.find.mockReturnValue(leanExec([]));
      taskModel.updateOne.mockResolvedValue({ modifiedCount: 1 });

      const futureDeadline = new Date(Date.now() + 3_600_000).toISOString();
      await service.updateTask(GROUP_ID, TASK_ID, { deadline: futureDeadline });

      const [, updateArgDeadline] = taskModel.updateOne.mock.calls[0] as [
        unknown,
        { $set: Record<string, unknown> },
      ];
      const $set = updateArgDeadline.$set;
      expect($set.reminderSentAt).toBeNull();
      expect($set.overdueSentAt).toBeNull();
    });

    it('should reset notification flags when assignee changes on an incomplete task', async () => {
      const nextAssigneeId = new Types.ObjectId().toString();

      taskModel.findOne
        .mockReturnValueOnce(leanExec(mockTask))
        .mockReturnValueOnce(leanExec(mockTask));

      statusModel.findById.mockReturnValue(
        selectLeanExec({
          _id: new Types.ObjectId(STATUS_ID),
          name: 'Todo',
          color: '#3B82F6',
          isCompleted: false,
        }),
      );
      userModel.findById.mockReturnValue(
        selectLeanExec({
          _id: new Types.ObjectId(nextAssigneeId),
          name: 'Next User',
          avatar: null,
        }),
      );
      taskLabelModel.find.mockReturnValue(leanExec([]));
      taskModel.updateOne.mockResolvedValue({ modifiedCount: 1 });

      await service.updateTask(GROUP_ID, TASK_ID, {
        assigneeId: nextAssigneeId,
      });

      const [, updateArgAssignee] = taskModel.updateOne.mock.calls[0] as [
        unknown,
        { $set: Record<string, unknown> },
      ];
      const $set = updateArgAssignee.$set;
      expect($set.assigneeId).toBeInstanceOf(Types.ObjectId);
      expect($set.reminderSentAt).toBeNull();
      expect($set.overdueSentAt).toBeNull();
    });

    it('should NOT reset notification flags when deadline changes on a completed task', async () => {
      const completedStatusId = new Types.ObjectId();
      const taskInCompleted = { ...mockTask, statusId: completedStatusId };

      taskModel.findOne
        .mockReturnValueOnce(leanExec(taskInCompleted))
        .mockReturnValueOnce(leanExec(taskInCompleted));

      statusModel.findById.mockReturnValue(
        selectLeanExec({
          _id: completedStatusId,
          name: 'Done',
          color: '#22C55E',
          isCompleted: true,
        }),
      );
      userModel.findById.mockReturnValue(
        selectLeanExec({
          _id: new Types.ObjectId(USER_ID),
          name: 'User',
          avatar: null,
        }),
      );
      taskLabelModel.find.mockReturnValue(leanExec([]));
      taskModel.updateOne.mockResolvedValue({ modifiedCount: 1 });

      const futureDeadline = new Date(Date.now() + 3_600_000).toISOString();
      await service.updateTask(GROUP_ID, TASK_ID, { deadline: futureDeadline });

      const [, updateArgCompleted] = taskModel.updateOne.mock.calls[0] as [
        unknown,
        { $set: Record<string, unknown> },
      ];
      const $set = updateArgCompleted.$set;
      expect($set.reminderSentAt).toBeUndefined();
      expect($set.overdueSentAt).toBeUndefined();
    });

    it('should throw BadRequestException when new deadline is in the past', async () => {
      taskModel.findOne.mockReturnValue(leanExec(mockTask));
      statusModel.findById.mockReturnValue(
        selectLeanExec({ isCompleted: false }),
      );

      const pastDeadline = new Date(Date.now() - 60_000).toISOString();
      await expect(
        service.updateTask(GROUP_ID, TASK_ID, { deadline: pastDeadline }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // =========================================================================
  // deleteTask
  // =========================================================================

  describe('deleteTask', () => {
    function setupDeleteMocks(role: GroupRole | null) {
      taskModel.findOne.mockReturnValue({
        select: jest
          .fn()
          .mockReturnValue(
            leanExec({ ...mockTask, creatorId: new Types.ObjectId() }),
          ),
      });

      groupMemberModel.findOne.mockReturnValue(
        selectLeanExec(role ? { role } : null),
      );

      const session = buildMockSession();
      taskModel.db.startSession.mockResolvedValue(session);
      taskLabelModel.deleteMany.mockResolvedValue({});
      taskCommentModel.deleteMany.mockResolvedValue({});
      taskAttachmentModel.deleteMany.mockResolvedValue({});
      taskModel.deleteOne.mockResolvedValue({});
    }

    it('should allow group owner to delete task', async () => {
      setupDeleteMocks(GroupRole.OWNER);

      await expect(
        service.deleteTask(GROUP_ID, TASK_ID, USER_ID),
      ).resolves.toBeUndefined();

      expect(taskModel.deleteOne).toHaveBeenCalled();
      expect(taskLabelModel.deleteMany).toHaveBeenCalled();
    });

    it('should allow group admin to delete task', async () => {
      setupDeleteMocks(GroupRole.ADMIN);

      await expect(
        service.deleteTask(GROUP_ID, TASK_ID, USER_ID),
      ).resolves.toBeUndefined();
      expect(taskModel.deleteOne).toHaveBeenCalled();
    });

    it('should throw ForbiddenException when requester is member only', async () => {
      setupDeleteMocks(GroupRole.MEMBER);

      await expect(
        service.deleteTask(GROUP_ID, TASK_ID, USER_ID),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException when requester has no membership', async () => {
      setupDeleteMocks(null);

      await expect(
        service.deleteTask(GROUP_ID, TASK_ID, USER_ID),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException when taskId is an invalid ObjectId', async () => {
      await expect(
        service.deleteTask(GROUP_ID, 'bad-id', USER_ID),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when groupId is an invalid ObjectId', async () => {
      await expect(
        service.deleteTask('bad-group', TASK_ID, USER_ID),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when task does not exist', async () => {
      taskModel.findOne.mockReturnValue({
        select: jest.fn().mockReturnValue(leanExec(null)),
      });

      await expect(
        service.deleteTask(GROUP_ID, TASK_ID, USER_ID),
      ).rejects.toThrow(NotFoundException);
    });

    it('should cascade-delete task_labels in the same transaction', async () => {
      setupDeleteMocks(GroupRole.OWNER);

      await service.deleteTask(GROUP_ID, TASK_ID, USER_ID);

      // Both deleteMany (task_labels) and deleteOne (task) must have been called
      expect(taskLabelModel.deleteMany).toHaveBeenCalledWith(
        expect.objectContaining({
          taskId: expect.any(Types.ObjectId) as unknown,
        }),
        expect.anything(),
      );
      expect(taskModel.deleteOne).toHaveBeenCalledWith(
        expect.objectContaining({ _id: expect.any(Types.ObjectId) as unknown }),
        expect.anything(),
      );
    });
  });
});
