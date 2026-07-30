import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './modules/auth/auth.module';
import { GroupModule } from './modules/group/group.module';
import { TaskModule } from './modules/task/task.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      expandVariables: true,
    }),
    ScheduleModule.forRoot(),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const uri = configService.get<string>('MONGODB_URI');
        const serverSelectionTimeoutMS = Number(
          configService.get<string>('MONGODB_SERVER_SELECTION_TIMEOUT_MS') ??
            10000,
        );
        const connectTimeoutMS = Number(
          configService.get<string>('MONGODB_CONNECT_TIMEOUT_MS') ?? 10000,
        );
        const socketTimeoutMS = Number(
          configService.get<string>('MONGODB_SOCKET_TIMEOUT_MS') ?? 15000,
        );

        if (!uri) {
          throw new Error('MONGODB_URI is not configured');
        }

        return {
          uri,
          serverSelectionTimeoutMS,
          connectTimeoutMS,
          socketTimeoutMS,
        };
      },
    }),
    AuthModule,
    GroupModule,
    TaskModule,
    DashboardModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
