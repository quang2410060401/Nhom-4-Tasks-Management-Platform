import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { AuthIndexesService } from './auth-indexes.service';
import { User } from './schemas/user.schema';

function buildUserModel() {
  return {
    updateMany: jest.fn(),
    syncIndexes: jest.fn(),
  };
}

describe('AuthIndexesService', () => {
  let service: AuthIndexesService;
  let userModel: ReturnType<typeof buildUserModel>;

  beforeEach(async () => {
    userModel = buildUserModel();
    userModel.updateMany.mockReturnValue({
      exec: jest.fn().mockResolvedValue({ modifiedCount: 2 }),
    });
    userModel.syncIndexes.mockResolvedValue(['email_1', 'googleId_1']);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthIndexesService,
        {
          provide: getModelToken(User.name),
          useValue: userModel,
        },
      ],
    }).compile();

    service = module.get<AuthIndexesService>(AuthIndexesService);
  });

  afterEach(() => jest.resetAllMocks());

  it('should clean legacy googleId values before syncing indexes', async () => {
    await service.onApplicationBootstrap();

    expect(userModel.updateMany).toHaveBeenCalledWith(
      { $or: [{ googleId: null }, { googleId: '' }] },
      { $unset: { googleId: 1 } },
    );
    expect(userModel.syncIndexes).toHaveBeenCalledTimes(1);
  });

  it('should propagate index sync errors', async () => {
    userModel.syncIndexes.mockRejectedValue(new Error('index sync failed'));

    await expect(service.onApplicationBootstrap()).rejects.toThrow(
      'index sync failed',
    );
  });
});
