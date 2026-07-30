import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { Types } from 'mongoose';
import { TaskNotificationService } from './task-notification.service';
import { Task } from './schemas/task.schema';
import { Status } from '../group/schemas/status.schema';
import { User } from '../auth/schemas/user.schema';
import { MailService } from '../../common/mail/mail.service';

// ---------------------------------------------------------------------------
// Mock helpers
// ---------------------------------------------------------------------------

function leanExec(value: unknown) {
  const exec = jest.fn().mockResolvedValue(value);
  return { lean: jest.fn().mockReturnValue({ exec }), exec };
}

function selectLeanExec(value: unknown) {
  const exec = jest.fn().mockResolvedValue(value);
  const lean = jest.fn().mockReturnValue({ exec });
  return { select: jest.fn().mockReturnValue({ lean, exec }) };
}

function execOnly(value: unknown) {
  return { exec: jest.fn().mockResolvedValue(value) };
}

// ---------------------------------------------------------------------------
// Shared test data
// ---------------------------------------------------------------------------

const statusId1 = new Types.ObjectId();
const creatorId = new Types.ObjectId();
const assigneeId = new Types.ObjectId();
const taskId1 = new Types.ObjectId();
const taskId2 = new Types.ObjectId();

const now = new Date();
const deadline30min = new Date(now.getTime() + 30 * 60 * 1000);
const deadlinePast = new Date(now.getTime() - 60 * 60 * 1000);

// ---------------------------------------------------------------------------

describe('TaskNotificationService', () => {
  let service: TaskNotificationService;
  let taskModel: {
    find: jest.Mock;
    updateOne: jest.Mock;
  };
  let statusModel: { distinct: jest.Mock };
  let userModel: { find: jest.Mock };
  let mailService: {
    sendTaskReminderEmail: jest.Mock;
    sendTaskOverdueEmail: jest.Mock;
  };

  beforeEach(async () => {
    taskModel = {
      find: jest.fn(),
      updateOne: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
    };

    statusModel = {
      distinct: jest.fn(),
    };

    userModel = {
      find: jest.fn(),
    };

    mailService = {
      sendTaskReminderEmail: jest.fn().mockResolvedValue(undefined),
      sendTaskOverdueEmail: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TaskNotificationService,
        { provide: getModelToken(Task.name), useValue: taskModel },
        { provide: getModelToken(Status.name), useValue: statusModel },
        { provide: getModelToken(User.name), useValue: userModel },
        { provide: MailService, useValue: mailService },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) =>
              key === 'ENABLE_INTERNAL_CRON' ? 'true' : undefined,
            ),
          },
        },
      ],
    }).compile();

    // Suppress logger output during tests
    service = module.get<TaskNotificationService>(TaskNotificationService);
    const logger = service['logger'];
    jest.spyOn(logger, 'log').mockImplementation(() => {});
    jest.spyOn(logger, 'warn').mockImplementation(() => {});
    jest.spyOn(logger, 'error').mockImplementation(() => {});
    jest.spyOn(logger, 'debug').mockImplementation(() => {});
  });

  afterEach(() => jest.clearAllMocks());

  // =========================================================================
  // sendReminderNotifications
  // =========================================================================

  describe('sendReminderNotifications', () => {
    function stubReminderSetup(tasks: object[]) {
      statusModel.distinct.mockReturnValue(execOnly([statusId1]));

      taskModel.find.mockReturnValue({
        select: jest.fn().mockReturnValue(leanExec(tasks)),
      });

      // userModel.find → select().lean().exec() returning user docs
      const userDocs = [
        { _id: creatorId, email: 'creator@test.com' },
        { _id: assigneeId, email: 'assignee@test.com' },
      ];
      userModel.find.mockReturnValue(selectLeanExec(userDocs));
    }

    it('returns early when no incomplete statuses exist', async () => {
      statusModel.distinct.mockReturnValue(execOnly([]));

      await service.sendReminderNotifications();

      expect(taskModel.find).not.toHaveBeenCalled();
      expect(mailService.sendTaskReminderEmail).not.toHaveBeenCalled();
    });

    it('returns early when no tasks match the reminder window', async () => {
      statusModel.distinct.mockReturnValue(execOnly([statusId1]));
      taskModel.find.mockReturnValue({
        select: jest.fn().mockReturnValue(leanExec([])),
      });

      await service.sendReminderNotifications();

      expect(userModel.find).not.toHaveBeenCalled();
      expect(mailService.sendTaskReminderEmail).not.toHaveBeenCalled();
    });

    it('sends reminder email to assignee when present', async () => {
      const task = {
        _id: taskId1,
        title: 'Task A',
        deadline: deadline30min,
        assigneeId,
        creatorId,
      };
      stubReminderSetup([task]);

      await service.sendReminderNotifications();

      expect(mailService.sendTaskReminderEmail).toHaveBeenCalledWith(
        'assignee@test.com',
        'Task A',
        deadline30min,
      );
    });

    it('falls back to creator email when assigneeId is absent', async () => {
      const task = {
        _id: taskId1,
        title: 'Task B',
        deadline: deadline30min,
        assigneeId: undefined,
        creatorId,
      };
      stubReminderSetup([task]);

      await service.sendReminderNotifications();

      expect(mailService.sendTaskReminderEmail).toHaveBeenCalledWith(
        'creator@test.com',
        'Task B',
        deadline30min,
      );
    });

    it('sets reminderSentAt after successful send', async () => {
      const task = {
        _id: taskId1,
        title: 'Task C',
        deadline: deadline30min,
        assigneeId,
        creatorId,
      };
      stubReminderSetup([task]);

      await service.sendReminderNotifications();

      expect(taskModel.updateOne).toHaveBeenCalledWith(
        {
          _id: taskId1,
          $or: [
            { reminderSentAt: null },
            { reminderSentAt: { $lt: expect.any(Date) as unknown } },
          ],
        },
        { $set: { reminderSentAt: expect.any(Date) as unknown } },
      );
    });

    it('does NOT set reminderSentAt when email send fails', async () => {
      const task = {
        _id: taskId1,
        title: 'Task D',
        deadline: deadline30min,
        assigneeId,
        creatorId,
      };
      stubReminderSetup([task]);
      mailService.sendTaskReminderEmail.mockRejectedValue(
        new Error('SMTP error'),
      );

      await service.sendReminderNotifications();

      expect(taskModel.updateOne).not.toHaveBeenCalled();
    });

    it('skips task when recipient email is not found', async () => {
      const unknownId = new Types.ObjectId();
      const task = {
        _id: taskId1,
        title: 'Task E',
        deadline: deadline30min,
        assigneeId: unknownId,
        creatorId,
      };
      statusModel.distinct.mockReturnValue(execOnly([statusId1]));
      taskModel.find.mockReturnValue({
        select: jest.fn().mockReturnValue(leanExec([task])),
      });
      // userModel returns docs that don't include unknownId
      userModel.find.mockReturnValue(
        selectLeanExec([{ _id: creatorId, email: 'creator@test.com' }]),
      );

      await service.sendReminderNotifications();

      expect(mailService.sendTaskReminderEmail).not.toHaveBeenCalled();
      expect(taskModel.updateOne).not.toHaveBeenCalled();
    });

    it('continues processing remaining tasks after one fails', async () => {
      const taskFail = {
        _id: taskId1,
        title: 'Fail',
        deadline: deadline30min,
        assigneeId,
        creatorId,
      };
      const taskOk = {
        _id: taskId2,
        title: 'Ok',
        deadline: deadline30min,
        assigneeId: undefined,
        creatorId,
      };
      stubReminderSetup([taskFail, taskOk]);
      mailService.sendTaskReminderEmail
        .mockRejectedValueOnce(new Error('SMTP'))
        .mockResolvedValueOnce(undefined);

      await service.sendReminderNotifications();

      expect(mailService.sendTaskReminderEmail).toHaveBeenCalledTimes(2);
      // Only taskOk (second) should be updated
      expect(taskModel.updateOne).toHaveBeenCalledTimes(1);
      expect(taskModel.updateOne).toHaveBeenCalledWith(
        {
          _id: taskId2,
          $or: [
            { reminderSentAt: null },
            { reminderSentAt: { $lt: expect.any(Date) as unknown } },
          ],
        },
        expect.anything(),
      );
    });

    it('performs exactly ONE user batch query regardless of task count', async () => {
      const tasks = [
        {
          _id: taskId1,
          title: 'T1',
          deadline: deadline30min,
          assigneeId,
          creatorId,
        },
        {
          _id: taskId2,
          title: 'T2',
          deadline: deadline30min,
          assigneeId: undefined,
          creatorId,
        },
      ];
      stubReminderSetup(tasks);

      await service.sendReminderNotifications();

      // userModel.find called once total (batch load)
      expect(userModel.find).toHaveBeenCalledTimes(1);
    });

    it('queries tasks with correct deadline window and reminder cooldown filter', async () => {
      statusModel.distinct.mockReturnValue(execOnly([statusId1]));
      const findSelectChain = {
        select: jest.fn().mockReturnValue(leanExec([])),
      };
      taskModel.find.mockReturnValue(findSelectChain);

      await service.sendReminderNotifications();

      const [[queryArg]] = taskModel.find.mock.calls as [
        [Record<string, Record<string, unknown>>],
      ];
      expect(queryArg.deadline.$gt).toBeInstanceOf(Date);
      expect(queryArg.deadline.$lte).toBeInstanceOf(Date);
      expect(queryArg.$or).toEqual([
        { reminderSentAt: null },
        { reminderSentAt: { $lt: expect.any(Date) as unknown } },
      ]);
      expect(queryArg.statusId.$in).toContain(statusId1);
    });
  });

  // =========================================================================
  // sendOverdueNotifications
  // =========================================================================

  describe('sendOverdueNotifications', () => {
    function stubOverdueSetup(tasks: object[]) {
      statusModel.distinct.mockReturnValue(execOnly([statusId1]));

      taskModel.find.mockReturnValue({
        select: jest.fn().mockReturnValue(leanExec(tasks)),
      });

      const userDocs = [
        { _id: creatorId, email: 'creator@test.com' },
        { _id: assigneeId, email: 'assignee@test.com' },
      ];
      userModel.find.mockReturnValue(selectLeanExec(userDocs));
    }

    it('returns early when no incomplete statuses exist', async () => {
      statusModel.distinct.mockReturnValue(execOnly([]));

      await service.sendOverdueNotifications();

      expect(taskModel.find).not.toHaveBeenCalled();
      expect(mailService.sendTaskOverdueEmail).not.toHaveBeenCalled();
    });

    it('returns early when no overdue tasks found', async () => {
      statusModel.distinct.mockReturnValue(execOnly([statusId1]));
      taskModel.find.mockReturnValue({
        select: jest.fn().mockReturnValue(leanExec([])),
      });

      await service.sendOverdueNotifications();

      expect(userModel.find).not.toHaveBeenCalled();
      expect(mailService.sendTaskOverdueEmail).not.toHaveBeenCalled();
    });

    it('sends overdue email to assignee when present', async () => {
      const task = {
        _id: taskId1,
        title: 'Overdue A',
        deadline: deadlinePast,
        assigneeId,
        creatorId,
      };
      stubOverdueSetup([task]);

      await service.sendOverdueNotifications();

      expect(mailService.sendTaskOverdueEmail).toHaveBeenCalledWith(
        'assignee@test.com',
        'Overdue A',
        deadlinePast,
      );
    });

    it('falls back to creator email when assigneeId is absent', async () => {
      const task = {
        _id: taskId1,
        title: 'Overdue B',
        deadline: deadlinePast,
        assigneeId: undefined,
        creatorId,
      };
      stubOverdueSetup([task]);

      await service.sendOverdueNotifications();

      expect(mailService.sendTaskOverdueEmail).toHaveBeenCalledWith(
        'creator@test.com',
        'Overdue B',
        deadlinePast,
      );
    });

    it('sets overdueSentAt after successful send', async () => {
      const task = {
        _id: taskId1,
        title: 'Overdue C',
        deadline: deadlinePast,
        assigneeId,
        creatorId,
      };
      stubOverdueSetup([task]);

      await service.sendOverdueNotifications();

      expect(taskModel.updateOne).toHaveBeenCalledWith(
        { _id: taskId1, overdueSentAt: null },
        { $set: { overdueSentAt: expect.any(Date) as unknown } },
      );
    });

    it('does NOT set overdueSentAt when email send fails', async () => {
      const task = {
        _id: taskId1,
        title: 'Overdue D',
        deadline: deadlinePast,
        assigneeId,
        creatorId,
      };
      stubOverdueSetup([task]);
      mailService.sendTaskOverdueEmail.mockRejectedValue(
        new Error('SMTP error'),
      );

      await service.sendOverdueNotifications();

      expect(taskModel.updateOne).not.toHaveBeenCalled();
    });

    it('skips task when recipient email is not found', async () => {
      const unknownId = new Types.ObjectId();
      const task = {
        _id: taskId1,
        title: 'Overdue E',
        deadline: deadlinePast,
        assigneeId: unknownId,
        creatorId,
      };
      statusModel.distinct.mockReturnValue(execOnly([statusId1]));
      taskModel.find.mockReturnValue({
        select: jest.fn().mockReturnValue(leanExec([task])),
      });
      userModel.find.mockReturnValue(
        selectLeanExec([{ _id: creatorId, email: 'creator@test.com' }]),
      );

      await service.sendOverdueNotifications();

      expect(mailService.sendTaskOverdueEmail).not.toHaveBeenCalled();
    });

    it('continues processing remaining tasks after one fails', async () => {
      const taskFail = {
        _id: taskId1,
        title: 'Fail',
        deadline: deadlinePast,
        assigneeId,
        creatorId,
      };
      const taskOk = {
        _id: taskId2,
        title: 'Ok',
        deadline: deadlinePast,
        assigneeId: undefined,
        creatorId,
      };
      stubOverdueSetup([taskFail, taskOk]);
      mailService.sendTaskOverdueEmail
        .mockRejectedValueOnce(new Error('SMTP'))
        .mockResolvedValueOnce(undefined);

      await service.sendOverdueNotifications();

      expect(mailService.sendTaskOverdueEmail).toHaveBeenCalledTimes(2);
      expect(taskModel.updateOne).toHaveBeenCalledTimes(1);
      expect(taskModel.updateOne).toHaveBeenCalledWith(
        { _id: taskId2, overdueSentAt: null },
        expect.anything(),
      );
    });

    it('performs exactly ONE user batch query regardless of task count', async () => {
      const tasks = [
        {
          _id: taskId1,
          title: 'O1',
          deadline: deadlinePast,
          assigneeId,
          creatorId,
        },
        {
          _id: taskId2,
          title: 'O2',
          deadline: deadlinePast,
          assigneeId: undefined,
          creatorId,
        },
      ];
      stubOverdueSetup(tasks);

      await service.sendOverdueNotifications();

      expect(userModel.find).toHaveBeenCalledTimes(1);
    });

    it('queries tasks with $ne null deadline and null overdueSentAt filter', async () => {
      statusModel.distinct.mockReturnValue(execOnly([statusId1]));
      taskModel.find.mockReturnValue({
        select: jest.fn().mockReturnValue(leanExec([])),
      });

      await service.sendOverdueNotifications();

      const [[queryArg]] = taskModel.find.mock.calls as [
        [Record<string, Record<string, unknown>>],
      ];
      expect(queryArg.overdueSentAt).toBeNull();
      expect(queryArg.deadline.$ne).toBeNull();
      expect(queryArg.deadline.$lt).toBeInstanceOf(Date);
      expect(queryArg.statusId.$in).toContain(statusId1);
    });

    it('deduplicates user IDs in the batch query when same user owns multiple tasks', async () => {
      const tasks = [
        {
          _id: taskId1,
          title: 'O1',
          deadline: deadlinePast,
          assigneeId,
          creatorId,
        },
        {
          _id: taskId2,
          title: 'O2',
          deadline: deadlinePast,
          assigneeId,
          creatorId,
        },
      ];
      stubOverdueSetup(tasks);

      await service.sendOverdueNotifications();

      // Only one user in the batch, but expect a single find call
      expect(userModel.find).toHaveBeenCalledTimes(1);
      const [[findArg]] = userModel.find.mock.calls as [
        [{ _id: { $in: Types.ObjectId[] } }],
      ];
      const inArray: Types.ObjectId[] = findArg._id.$in;
      // Deduplicated: assigneeId appears once
      const uniqueIds = new Set(inArray.map((id) => id.toString()));
      expect(uniqueIds.size).toBe(inArray.length);
    });
  });
});
