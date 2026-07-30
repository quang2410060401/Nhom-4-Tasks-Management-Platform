import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { Types } from 'mongoose';
import { User } from '../auth/schemas/user.schema';
import { GroupMember } from '../group/schemas/group-member.schema';
import { Group } from '../group/schemas/group.schema';
import { GroupRole } from '../group/enums/group-role.enum';
import { Status } from '../group/schemas/status.schema';
import { Task } from '../task/schemas/task.schema';
import { DashboardService } from './dashboard.service';

const GROUP_ID = new Types.ObjectId().toString();
const STATUS_TODO_ID = new Types.ObjectId();
const STATUS_DOING_ID = new Types.ObjectId();
const STATUS_DONE_ID = new Types.ObjectId();
const USER_A_ID = new Types.ObjectId();
const USER_B_ID = new Types.ObjectId();
const USER_C_ID = new Types.ObjectId();
const GROUP_ALPHA_ID = new Types.ObjectId();
const GROUP_BETA_ID = new Types.ObjectId();

const mockStatuses = [
  {
    _id: STATUS_TODO_ID,
    name: 'Todo',
    color: '#3B82F6',
    isCompleted: false,
    order: 1,
  },
  {
    _id: STATUS_DOING_ID,
    name: 'Doing',
    color: '#F59E0B',
    isCompleted: false,
    order: 2,
  },
  {
    _id: STATUS_DONE_ID,
    name: 'Done',
    color: '#10B981',
    isCompleted: true,
    order: 3,
  },
];

function createExecChain<T>(value: T) {
  return { exec: jest.fn().mockResolvedValue(value) };
}

function createFindChain<T>(value: T) {
  return {
    select: jest.fn().mockReturnValue({
      sort: jest.fn().mockReturnValue({
        limit: jest.fn().mockReturnValue({
          lean: jest.fn().mockReturnValue(createExecChain(value)),
        }),
      }),
    }),
  };
}

function createSelectLeanChain<T>(value: T) {
  return {
    select: jest.fn().mockReturnValue({
      lean: jest.fn().mockReturnValue(createExecChain(value)),
    }),
  };
}

function buildTaskModel() {
  return {
    countDocuments: jest.fn().mockReturnValue(createExecChain(0)),
    aggregate: jest.fn().mockResolvedValue([]),
    find: jest.fn(),
  };
}

function buildStatusModel(statuses = mockStatuses) {
  return {
    find: jest.fn().mockReturnValue(createSelectLeanChain(statuses)),
  };
}

function buildUserModel(users: unknown[] = []) {
  return {
    find: jest.fn().mockReturnValue(createSelectLeanChain(users)),
  };
}

function buildGroupModel(groups: unknown[] = []) {
  return {
    find: jest.fn().mockReturnValue(createSelectLeanChain(groups)),
  };
}

function buildGroupMemberModel(memberships: unknown[] = []) {
  return {
    find: jest.fn().mockReturnValue(createSelectLeanChain(memberships)),
  };
}

describe('DashboardService', () => {
  let service: DashboardService;
  let taskModel: ReturnType<typeof buildTaskModel>;
  let statusModel: ReturnType<typeof buildStatusModel>;
  let userModel: ReturnType<typeof buildUserModel>;
  let groupModel: ReturnType<typeof buildGroupModel>;
  let groupMemberModel: ReturnType<typeof buildGroupMemberModel>;

  function mockAggregateResponses({
    statusCounts = [],
    overdueCount = 0,
    assigneeStats = [],
  }: {
    statusCounts?: { _id: Types.ObjectId; count: number }[];
    overdueCount?: number;
    assigneeStats?: {
      _id: Types.ObjectId | null;
      total: number;
      done: number;
    }[];
  }) {
    taskModel.aggregate.mockImplementation((pipeline: unknown[]) => {
      const stages = pipeline as Array<Record<string, unknown>>;
      const hasCount = stages.some((stage) => '$count' in stage);
      const groupStage = stages.find((stage) => '$group' in stage) as
        | { $group: { _id: unknown } }
        | undefined;

      if (groupStage?.$group._id === '$statusId') {
        return Promise.resolve(statusCounts);
      }

      if (groupStage?.$group._id === '$assigneeId') {
        return Promise.resolve(assigneeStats);
      }

      if (hasCount) {
        return Promise.resolve(
          overdueCount > 0 ? [{ count: overdueCount }] : [],
        );
      }

      return Promise.resolve([]);
    });
  }

  function mockTaskFinds({
    recentTasks = [],
    attentionTasks = [],
  }: {
    recentTasks?: unknown[];
    attentionTasks?: unknown[];
  }) {
    taskModel.find.mockReset();
    taskModel.find
      .mockImplementationOnce(() => createFindChain(recentTasks))
      .mockImplementationOnce(() => createFindChain(attentionTasks));
  }

  beforeEach(async () => {
    taskModel = buildTaskModel();
    statusModel = buildStatusModel();
    userModel = buildUserModel();
    groupModel = buildGroupModel();
    groupMemberModel = buildGroupMemberModel();

    mockAggregateResponses({});
    mockTaskFinds({});

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardService,
        { provide: getModelToken(Task.name), useValue: taskModel },
        { provide: getModelToken(Status.name), useValue: statusModel },
        { provide: getModelToken(User.name), useValue: userModel },
        { provide: getModelToken(Group.name), useValue: groupModel },
        {
          provide: getModelToken(GroupMember.name),
          useValue: groupMemberModel,
        },
      ],
    }).compile();

    service = module.get<DashboardService>(DashboardService);
  });

  afterEach(() => jest.resetAllMocks());

  it('trả về đầy đủ payload overview mới khi group chưa có task', async () => {
    const result = await service.getDashboard(GROUP_ID);

    expect(result).toMatchObject({
      totalTasks: 0,
      completedTasks: 0,
      overdueCount: 0,
      completionRate: 0,
      tasksByAssignee: [],
      recentTasks: [],
      attentionTasks: [],
    });
    expect(result.statusBreakdown).toEqual([
      {
        statusId: STATUS_TODO_ID.toString(),
        name: 'Todo',
        color: '#3B82F6',
        isCompleted: false,
        count: 0,
      },
      {
        statusId: STATUS_DOING_ID.toString(),
        name: 'Doing',
        color: '#F59E0B',
        isCompleted: false,
        count: 0,
      },
      {
        statusId: STATUS_DONE_ID.toString(),
        name: 'Done',
        color: '#10B981',
        isCompleted: true,
        count: 0,
      },
    ]);
  });

  it('tính completedTasks và completionRate theo status.isCompleted thay vì hardcode tên', async () => {
    taskModel.countDocuments.mockReturnValue(createExecChain(10));
    mockAggregateResponses({
      statusCounts: [
        { _id: STATUS_TODO_ID, count: 3 },
        { _id: STATUS_DOING_ID, count: 2 },
        { _id: STATUS_DONE_ID, count: 5 },
      ],
      overdueCount: 2,
    });
    mockTaskFinds({});

    const result = await service.getDashboard(GROUP_ID);

    expect(result.completedTasks).toBe(5);
    expect(result.completionRate).toBe(50);
    expect(result.overdueCount).toBe(2);
    expect(result.statusBreakdown[2]).toMatchObject({
      statusId: STATUS_DONE_ID.toString(),
      isCompleted: true,
      count: 5,
    });
  });

  it('build recentTasks đúng thứ tự createdAt desc và resolve assignee/status', async () => {
    const recentTasks = [
      {
        _id: new Types.ObjectId(),
        title: 'Task mới nhất',
        createdAt: new Date('2026-03-15T09:00:00.000Z'),
        deadline: new Date('2026-03-17T09:00:00.000Z'),
        assigneeId: USER_A_ID,
        statusId: STATUS_DOING_ID,
      },
      {
        _id: new Types.ObjectId(),
        title: 'Task thứ hai',
        createdAt: new Date('2026-03-14T09:00:00.000Z'),
        deadline: null,
        assigneeId: null,
        statusId: STATUS_TODO_ID,
      },
    ];

    mockTaskFinds({ recentTasks });
    userModel = buildUserModel([
      { _id: USER_A_ID, name: 'Nguyen Van A', avatar: null },
    ]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardService,
        { provide: getModelToken(Task.name), useValue: taskModel },
        { provide: getModelToken(Status.name), useValue: statusModel },
        { provide: getModelToken(User.name), useValue: userModel },
        { provide: getModelToken(Group.name), useValue: groupModel },
        {
          provide: getModelToken(GroupMember.name),
          useValue: groupMemberModel,
        },
      ],
    }).compile();
    service = module.get<DashboardService>(DashboardService);

    const result = await service.getDashboard(GROUP_ID);

    expect(result.recentTasks).toHaveLength(2);
    expect(result.recentTasks[0]).toMatchObject({
      taskId: recentTasks[0]._id.toString(),
      title: 'Task mới nhất',
      assignee: {
        userId: USER_A_ID.toString(),
        name: 'Nguyen Van A',
        avatar: null,
      },
      status: {
        statusId: STATUS_DOING_ID.toString(),
        name: 'Doing',
        color: '#F59E0B',
        isCompleted: false,
      },
    });
    expect(result.recentTasks[1].assignee).toBeNull();
  });

  it('build attentionTasks với overdue trước và chỉ giữ incomplete tasks đến hết hôm nay', async () => {
    const now = Date.now();
    const attentionTasks = [
      {
        _id: new Types.ObjectId(),
        title: 'Task quá hạn',
        createdAt: new Date(now - 5 * 24 * 60 * 60 * 1000),
        deadline: new Date(now - 24 * 60 * 60 * 1000),
        assigneeId: USER_A_ID,
        statusId: STATUS_TODO_ID,
      },
      {
        _id: new Types.ObjectId(),
        title: 'Task sắp đến hạn',
        createdAt: new Date(now - 3 * 24 * 60 * 60 * 1000),
        deadline: new Date(now + 2 * 24 * 60 * 60 * 1000),
        assigneeId: USER_B_ID,
        statusId: STATUS_DOING_ID,
      },
    ];

    mockTaskFinds({ attentionTasks });
    userModel = buildUserModel([
      { _id: USER_A_ID, name: 'Nguyen Van A', avatar: null },
      {
        _id: USER_B_ID,
        name: 'Tran Thi B',
        avatar: 'https://example.com/b.jpg',
      },
    ]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardService,
        { provide: getModelToken(Task.name), useValue: taskModel },
        { provide: getModelToken(Status.name), useValue: statusModel },
        { provide: getModelToken(User.name), useValue: userModel },
        { provide: getModelToken(Group.name), useValue: groupModel },
        {
          provide: getModelToken(GroupMember.name),
          useValue: groupMemberModel,
        },
      ],
    }).compile();
    service = module.get<DashboardService>(DashboardService);

    const result = await service.getDashboard(GROUP_ID);

    expect(result.attentionTasks).toHaveLength(2);
    const secondFindCall = taskModel.find.mock.calls.at(1) as
      | [
          {
            groupId: Types.ObjectId;
            deadline: { $ne: null; $lte: Date };
          },
        ]
      | undefined;
    expect(secondFindCall).toBeDefined();
    const [secondFindArgs] = secondFindCall!;
    expect(secondFindArgs.groupId).toBeInstanceOf(Types.ObjectId);
    expect(secondFindArgs.deadline.$ne).toBeNull();
    expect(secondFindArgs.deadline.$lte).toBeInstanceOf(Date);
    expect(result.attentionTasks[0]).toMatchObject({
      taskId: attentionTasks[0]._id.toString(),
      kind: 'overdue',
    });
    expect(result.attentionTasks[1]).toMatchObject({
      taskId: attentionTasks[1]._id.toString(),
      kind: 'upcoming',
    });
    const expectedCutoff = new Date();
    expectedCutoff.setHours(23, 59, 59, 999);
    expect(secondFindArgs.deadline.$lte.getHours()).toBe(
      expectedCutoff.getHours(),
    );
    expect(secondFindArgs.deadline.$lte.getMinutes()).toBe(
      expectedCutoff.getMinutes(),
    );
  });

  it('ghép tasksByAssignee đúng với batch user lookup', async () => {
    mockAggregateResponses({
      assigneeStats: [
        { _id: USER_A_ID, total: 6, done: 4 },
        { _id: USER_B_ID, total: 4, done: 1 },
      ],
    });
    mockTaskFinds({});
    userModel = buildUserModel([
      { _id: USER_A_ID, name: 'Nguyen Van A', avatar: null },
      {
        _id: USER_B_ID,
        name: 'Tran Thi B',
        avatar: 'https://example.com/b.jpg',
      },
    ]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardService,
        { provide: getModelToken(Task.name), useValue: taskModel },
        { provide: getModelToken(Status.name), useValue: statusModel },
        { provide: getModelToken(User.name), useValue: userModel },
        { provide: getModelToken(Group.name), useValue: groupModel },
        {
          provide: getModelToken(GroupMember.name),
          useValue: groupMemberModel,
        },
      ],
    }).compile();
    service = module.get<DashboardService>(DashboardService);

    const result = await service.getDashboard(GROUP_ID);

    expect(result.tasksByAssignee).toEqual([
      {
        userId: USER_A_ID.toString(),
        name: 'Nguyen Van A',
        avatar: null,
        total: 6,
        done: 4,
      },
      {
        userId: USER_B_ID.toString(),
        name: 'Tran Thi B',
        avatar: 'https://example.com/b.jpg',
        total: 4,
        done: 1,
      },
    ]);
  });

  it('getMyDashboard chỉ tính task assigned cho user hiện tại và group user còn là member', async () => {
    const requesterId = USER_A_ID.toString();
    const now = Date.now();
    const myMemberships = [
      { groupId: GROUP_ALPHA_ID, role: GroupRole.OWNER },
      { groupId: GROUP_BETA_ID, role: GroupRole.MEMBER },
    ];
    const myTasks = [
      {
        _id: new Types.ObjectId(),
        title: 'Task overdue',
        groupId: GROUP_ALPHA_ID,
        statusId: STATUS_TODO_ID,
        deadline: new Date(now - 60 * 60 * 1000),
        createdAt: new Date(now - 3 * 24 * 60 * 60 * 1000),
        updatedAt: new Date(now - 10 * 60 * 1000),
      },
      {
        _id: new Types.ObjectId(),
        title: 'Task due today',
        groupId: GROUP_ALPHA_ID,
        statusId: STATUS_DOING_ID,
        deadline: new Date(now + 60 * 60 * 1000),
        createdAt: new Date(now - 2 * 24 * 60 * 60 * 1000),
        updatedAt: new Date(now - 5 * 60 * 1000),
      },
      {
        _id: new Types.ObjectId(),
        title: 'Task done',
        groupId: GROUP_BETA_ID,
        statusId: STATUS_DONE_ID,
        deadline: null,
        createdAt: new Date(now - 24 * 60 * 60 * 1000),
        updatedAt: new Date(now - 2 * 60 * 1000),
      },
    ];

    groupMemberModel = buildGroupMemberModel(myMemberships);
    groupModel = buildGroupModel([
      { _id: GROUP_ALPHA_ID, name: 'Alpha' },
      { _id: GROUP_BETA_ID, name: 'Beta' },
    ]);
    taskModel.find.mockReset();
    taskModel.find.mockReturnValueOnce({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockReturnValue(createExecChain(myTasks)),
      }),
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardService,
        { provide: getModelToken(Task.name), useValue: taskModel },
        { provide: getModelToken(Status.name), useValue: statusModel },
        { provide: getModelToken(User.name), useValue: userModel },
        { provide: getModelToken(Group.name), useValue: groupModel },
        {
          provide: getModelToken(GroupMember.name),
          useValue: groupMemberModel,
        },
      ],
    }).compile();
    service = module.get<DashboardService>(DashboardService);

    const result = await service.getMyDashboard(requesterId);

    expect(result.summary).toMatchObject({
      assignedTasks: 3,
      openTasks: 2,
      completedTasks: 1,
      dueTodayCount: 1,
      overdueCount: 1,
      groupCount: 2,
    });
    expect(result.attentionTasks).toHaveLength(2);
    expect(result.attentionTasks[0].title).toBe('Task overdue');
    expect(result.recentTasks[0].title).toBe('Task done');
    expect(result.groups[0]).toMatchObject({
      groupId: GROUP_ALPHA_ID.toString(),
      name: 'Alpha',
      role: GroupRole.OWNER,
      assignedTasks: 2,
      completionRate: 0,
    });
    expect(result.groups[1]).toMatchObject({
      groupId: GROUP_BETA_ID.toString(),
      name: 'Beta',
      role: GroupRole.MEMBER,
      assignedTasks: 1,
      completedTasks: 1,
      completionRate: 100,
    });
  });

  it('getMyDashboard trả empty payload khi user không có membership hoặc không có task được giao', async () => {
    const requesterId = USER_C_ID.toString();
    groupMemberModel = buildGroupMemberModel([]);

    let module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardService,
        { provide: getModelToken(Task.name), useValue: taskModel },
        { provide: getModelToken(Status.name), useValue: statusModel },
        { provide: getModelToken(User.name), useValue: userModel },
        { provide: getModelToken(Group.name), useValue: groupModel },
        {
          provide: getModelToken(GroupMember.name),
          useValue: groupMemberModel,
        },
      ],
    }).compile();
    service = module.get<DashboardService>(DashboardService);

    await expect(service.getMyDashboard(requesterId)).resolves.toEqual({
      summary: {
        assignedTasks: 0,
        openTasks: 0,
        completedTasks: 0,
        dueTodayCount: 0,
        overdueCount: 0,
        groupCount: 0,
      },
      attentionTasks: [],
      recentTasks: [],
      groups: [],
    });

    groupMemberModel = buildGroupMemberModel([
      { groupId: GROUP_ALPHA_ID, role: GroupRole.ADMIN },
    ]);
    taskModel.find.mockReset();
    taskModel.find.mockReturnValueOnce({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockReturnValue(createExecChain([])),
      }),
    });

    module = await Test.createTestingModule({
      providers: [
        DashboardService,
        { provide: getModelToken(Task.name), useValue: taskModel },
        { provide: getModelToken(Status.name), useValue: statusModel },
        { provide: getModelToken(User.name), useValue: userModel },
        { provide: getModelToken(Group.name), useValue: groupModel },
        {
          provide: getModelToken(GroupMember.name),
          useValue: groupMemberModel,
        },
      ],
    }).compile();
    service = module.get<DashboardService>(DashboardService);

    await expect(service.getMyDashboard(requesterId)).resolves.toEqual({
      summary: {
        assignedTasks: 0,
        openTasks: 0,
        completedTasks: 0,
        dueTodayCount: 0,
        overdueCount: 0,
        groupCount: 0,
      },
      attentionTasks: [],
      recentTasks: [],
      groups: [],
    });
  });
});
