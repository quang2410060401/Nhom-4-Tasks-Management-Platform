import {
  Controller,
  Get,
  HttpStatus,
  Logger,
  Param,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { GroupMemberGuard } from '../group/guards/group-member.guard';
import { DashboardService } from './dashboard.service';
import { DashboardData } from './dashboard.types';

@ApiTags('Dashboard')
@ApiBearerAuth()
@ApiUnauthorizedResponse({
  description: 'Token không được cung cấp hoặc không hợp lệ',
})
@ApiForbiddenResponse({ description: 'Không phải thành viên của nhóm' })
@UseGuards(JwtAuthGuard)
@Controller('groups/:groupId')
export class DashboardController {
  private readonly logger = new Logger(DashboardController.name);

  constructor(private readonly dashboardService: DashboardService) {}

  // GET /api/groups/:groupId/dashboard
  @Get('dashboard')
  @UseGuards(GroupMemberGuard)
  @ApiOperation({
    summary: 'Lấy dữ liệu dashboard của nhóm',
    description:
      'Trả về tổng quan tiến độ công việc: phân bổ theo status, tỷ lệ hoàn thành, ' +
      'số tasks quá hạn, danh sách công việc gần đây/cần chú ý và thống kê theo từng thành viên. Yêu cầu quyền member.',
  })
  @ApiOkResponse({
    description: 'Dữ liệu dashboard của nhóm.',
    schema: {
      example: {
        statusCode: 200,
        data: {
          totalTasks: 50,
          completedTasks: 15,
          statusBreakdown: [
            {
              statusId: '507f1f77bcf86cd799439011',
              name: 'Todo',
              color: '#3B82F6',
              isCompleted: false,
              count: 15,
            },
            {
              statusId: '507f1f77bcf86cd799439012',
              name: 'Doing',
              color: '#F59E0B',
              isCompleted: false,
              count: 20,
            },
            {
              statusId: '507f1f77bcf86cd799439013',
              name: 'Done',
              color: '#10B981',
              isCompleted: true,
              count: 15,
            },
          ],
          overdueCount: 3,
          completionRate: 30.0,
          tasksByAssignee: [
            {
              userId: '507f1f77bcf86cd799439021',
              name: 'Nguyen Van A',
              avatar: null,
              total: 10,
              done: 5,
            },
          ],
          recentTasks: [
            {
              taskId: '507f1f77bcf86cd799439031',
              title: 'Thiết kế luồng đăng nhập',
              createdAt: '2026-03-15T02:00:00.000Z',
              deadline: '2026-03-18T10:00:00.000Z',
              assignee: {
                userId: '507f1f77bcf86cd799439021',
                name: 'Nguyen Van A',
                avatar: null,
              },
              status: {
                statusId: '507f1f77bcf86cd799439012',
                name: 'Doing',
                color: '#F59E0B',
                isCompleted: false,
              },
            },
          ],
          attentionTasks: [
            {
              taskId: '507f1f77bcf86cd799439041',
              title: 'Fix reminder cron',
              createdAt: '2026-03-14T09:00:00.000Z',
              deadline: '2026-03-15T08:00:00.000Z',
              assignee: null,
              status: {
                statusId: '507f1f77bcf86cd799439011',
                name: 'Todo',
                color: '#3B82F6',
                isCompleted: false,
              },
              kind: 'overdue',
            },
          ],
        },
      },
    },
  })
  @ApiNotFoundResponse({ description: 'Nhóm không tồn tại' })
  async getDashboard(
    @Param('groupId') groupId: string,
  ): Promise<{ statusCode: number; data: DashboardData }> {
    const data = await this.dashboardService.getDashboard(groupId);
    return { statusCode: HttpStatus.OK, data };
  }
}
