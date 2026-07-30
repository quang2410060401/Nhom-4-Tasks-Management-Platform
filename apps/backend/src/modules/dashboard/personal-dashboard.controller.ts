import { Controller, Get, HttpStatus, UseGuards } from '@nestjs/common';
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
import { DashboardService } from './dashboard.service';
import type { MyDashboardData } from './dashboard.types';

@ApiTags('Dashboard')
@ApiBearerAuth()
@ApiUnauthorizedResponse({
  description: 'Token không được cung cấp hoặc không hợp lệ',
})
@ApiForbiddenResponse({
  description: 'Không có quyền truy cập dashboard cá nhân',
})
@UseGuards(JwtAuthGuard)
@Controller('dashboard')
export class PersonalDashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('me')
  @ApiOperation({
    summary: 'Lấy dashboard cá nhân của người dùng hiện tại',
    description:
      'Trả về snapshot công việc được giao cho current user trên tất cả các nhóm mà người dùng còn là thành viên.',
  })
  @ApiOkResponse({
    description: 'Dữ liệu dashboard cá nhân.',
  })
  async getMyDashboard(
    @CurrentUser() user: JwtPayload,
  ): Promise<{ statusCode: number; data: MyDashboardData }> {
    const data = await this.dashboardService.getMyDashboard(user.sub);
    return { statusCode: HttpStatus.OK, data };
  }
}
