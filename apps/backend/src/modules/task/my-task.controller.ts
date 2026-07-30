import { Controller, Get, HttpStatus, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import type { JwtPayload } from '../../common/types/jwt-payload.type';
import { ListMyTaskQueryDto } from './dto/list-my-task-query.dto';
import { TaskService } from './task.service';

@ApiTags('Tasks')
@ApiBearerAuth()
@ApiUnauthorizedResponse({
  description: 'Token không được cung cấp hoặc không hợp lệ',
})
@ApiForbiddenResponse({
  description: 'Không có quyền truy cập danh sách công việc này',
})
@UseGuards(JwtAuthGuard)
@Controller('tasks')
export class MyTaskController {
  constructor(private readonly taskService: TaskService) {}

  @Get('my')
  @ApiOperation({
    summary: 'Lấy toàn bộ công việc được giao cho tôi, nhóm theo group',
  })
  @ApiOkResponse({
    description: 'Danh sách task được giao cho current user, group theo group',
  })
  async getMyTasks(
    @Query() query: ListMyTaskQueryDto,
    @CurrentUser() user: JwtPayload,
  ) {
    const result = await this.taskService.getMyTasks(user.sub, query);
    return { statusCode: HttpStatus.OK, data: result };
  }
}
