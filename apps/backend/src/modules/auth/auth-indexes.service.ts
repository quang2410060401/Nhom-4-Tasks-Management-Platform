import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from './schemas/user.schema';

@Injectable()
export class AuthIndexesService implements OnApplicationBootstrap {
  private readonly logger = new Logger(AuthIndexesService.name);

  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    // Dọn dữ liệu legacy trước khi đồng bộ index:
    // các local account cũ từng bị lưu `googleId: null` hoặc `''`.
    const cleanupResult = await this.userModel
      .updateMany(
        { $or: [{ googleId: null }, { googleId: '' }] },
        { $unset: { googleId: 1 } },
      )
      .exec();

    await this.userModel.syncIndexes();

    this.logger.log(
      `User indexes synced; cleaned ${cleanupResult.modifiedCount} legacy googleId values.`,
    );
  }
}
