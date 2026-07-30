import {
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  InternalServerErrorException,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiExcludeController } from '@nestjs/swagger';
import { TaskNotificationService } from './task-notification.service';

@ApiExcludeController()
@Controller('internal/task-notifications')
export class TaskInternalController {
  constructor(
    private readonly configService: ConfigService,
    private readonly taskNotificationService: TaskNotificationService,
  ) {}

  private assertCronAuthorization(authorization: string | undefined): void {
    const expectedSecret = this.configService.get<string>('CRON_SECRET');

    if (!expectedSecret) {
      throw new InternalServerErrorException('CRON_SECRET is not configured');
    }

    const receivedSecret = authorization?.startsWith('Bearer ')
      ? authorization.slice('Bearer '.length).trim()
      : undefined;

    if (!receivedSecret || receivedSecret !== expectedSecret) {
      throw new UnauthorizedException('Cron authorization failed');
    }
  }

  private async executeTaskNotificationJobs() {
    await this.taskNotificationService.sendReminderNotifications();
    await this.taskNotificationService.sendOverdueNotifications();

    return {
      statusCode: HttpStatus.OK,
      message: 'Task notification jobs executed',
      data: {
        executedAt: new Date().toISOString(),
      },
    };
  }

  @Get('run')
  @HttpCode(HttpStatus.OK)
  async runTaskNotificationJobsByGet(
    @Headers('authorization') authorization?: string,
  ) {
    this.assertCronAuthorization(authorization);
    return this.executeTaskNotificationJobs();
  }

  @Post('run')
  @HttpCode(HttpStatus.OK)
  async runTaskNotificationJobsByPost(
    @Headers('authorization') authorization?: string,
  ) {
    this.assertCronAuthorization(authorization);
    return this.executeTaskNotificationJobs();
  }
}
