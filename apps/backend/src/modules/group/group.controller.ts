import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import type { JwtPayload } from '../../common/types/jwt-payload.type';
import { AcceptInviteDto } from './dto/accept-invite.dto';
import { CreateGroupDto } from './dto/create-group.dto';
import { CreateLabelDto } from './dto/create-label.dto';
import { CreateStatusDto } from './dto/create-status.dto';
import { InviteMemberDto } from './dto/invite-member.dto';
import { ListGroupPresetsQueryDto } from './dto/list-group-presets-query.dto';
import { ListMemberCandidatesQueryDto } from './dto/list-member-candidates-query.dto';
import { UpdateGroupDto } from './dto/update-group.dto';
import { UpdateLabelDto } from './dto/update-label.dto';
import { UpdateMemberRoleDto } from './dto/update-member-role.dto';
import { UpdateStatusDto } from './dto/update-status.dto';
import { ActiveMembership } from './decorators/group-membership.decorator';
import { GroupAdminGuard } from './guards/group-admin.guard';
import { GroupMemberGuard } from './guards/group-member.guard';
import { GroupOwnerGuard } from './guards/group-owner.guard';
import { GroupService } from './group.service';
import type { GroupMembership } from './types/group-request.type';

@ApiTags('Groups')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('groups')
export class GroupController {
  private readonly logger = new Logger(GroupController.name);

  constructor(private readonly groupService: GroupService) {}

  // ---------------------------------------------------------------------------
  // POST /groups — Tạo nhóm mới
  // ---------------------------------------------------------------------------

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Tạo nhóm mới và auto-seed 3 statuses mặc định' })
  @ApiResponse({ status: 201, description: 'Nhóm tạo thành công' })
  @ApiResponse({ status: 400, description: 'Dữ liệu đầu vào không hợp lệ' })
  @ApiResponse({ status: 401, description: 'Chưa xác thực' })
  async createGroup(
    @Body() dto: CreateGroupDto,
    @CurrentUser() user: JwtPayload,
  ) {
    const result = await this.groupService.createGroup(
      dto,
      user.sub,
      user.email,
    );
    return { statusCode: 201, data: result };
  }

  @Get('status-presets')
  @ApiOperation({ summary: 'Lấy preset statuses tổng hợp từ hệ thống' })
  @ApiResponse({ status: 200, description: 'Danh sách preset statuses' })
  @ApiResponse({ status: 401, description: 'Chưa xác thực' })
  async getStatusPresets(@Query() query: ListGroupPresetsQueryDto) {
    const data = await this.groupService.getStatusPresets(query);
    return { statusCode: 200, data };
  }

  @Get('label-presets')
  @ApiOperation({ summary: 'Lấy preset labels tổng hợp từ hệ thống' })
  @ApiResponse({ status: 200, description: 'Danh sách preset labels' })
  @ApiResponse({ status: 401, description: 'Chưa xác thực' })
  async getLabelPresets(@Query() query: ListGroupPresetsQueryDto) {
    const data = await this.groupService.getLabelPresets(query);
    return { statusCode: 200, data };
  }

  @Get('member-candidates')
  @ApiOperation({ summary: 'Tìm kiếm user sẵn có để mời vào group' })
  @ApiResponse({ status: 200, description: 'Danh sách user candidates' })
  @ApiResponse({ status: 401, description: 'Chưa xác thực' })
  async getMemberCandidates(
    @Query() query: ListMemberCandidatesQueryDto,
    @CurrentUser() user: JwtPayload,
  ) {
    const data = await this.groupService.getMemberCandidates(query, user.sub);
    return { statusCode: 200, data };
  }

  // ---------------------------------------------------------------------------
  // GET /groups — Danh sách nhóm của tôi
  // ---------------------------------------------------------------------------

  @Get()
  @ApiOperation({ summary: 'Lấy danh sách nhóm mà user đang là thành viên' })
  @ApiResponse({ status: 200, description: 'Danh sách nhóm của user' })
  @ApiResponse({ status: 401, description: 'Chưa xác thực' })
  async getMyGroups(@CurrentUser() user: JwtPayload) {
    const data = await this.groupService.getMyGroups(user.sub);
    return { statusCode: 200, data };
  }

  // ---------------------------------------------------------------------------
  // GET /groups/:groupId — Chi tiết nhóm (chỉ member)
  // ---------------------------------------------------------------------------

  @Get(':groupId')
  @UseGuards(GroupMemberGuard)
  @ApiOperation({ summary: 'Lấy chi tiết nhóm và danh sách thành viên' })
  @ApiResponse({ status: 200, description: 'Chi tiết nhóm' })
  @ApiResponse({ status: 401, description: 'Chưa xác thực' })
  @ApiResponse({ status: 403, description: 'Không phải thành viên của nhóm' })
  @ApiResponse({ status: 404, description: 'Nhóm không tồn tại' })
  async getGroupDetail(
    @Param('groupId') groupId: string,
    @ActiveMembership() membership: GroupMembership,
  ) {
    const data = await this.groupService.getGroupDetail(
      groupId,
      membership.role,
    );
    return { statusCode: 200, data };
  }

  @Patch(':groupId')
  @UseGuards(GroupAdminGuard)
  @ApiOperation({ summary: 'Owner/Admin cập nhật thông tin cơ bản của nhóm' })
  @ApiResponse({ status: 200, description: 'Nhóm đã được cập nhật' })
  @ApiResponse({
    status: 400,
    description: 'Tên nhóm trùng hoặc payload aggregate không hợp lệ',
  })
  @ApiResponse({ status: 401, description: 'Chưa xác thực' })
  @ApiResponse({ status: 403, description: 'Không phải owner/admin' })
  @ApiResponse({ status: 404, description: 'Nhóm không tồn tại' })
  async updateGroup(
    @Param('groupId') groupId: string,
    @Body() dto: UpdateGroupDto,
    @CurrentUser() user: JwtPayload,
  ) {
    const data = await this.groupService.updateGroup(
      groupId,
      dto,
      user.sub,
      user.email,
    );
    return { statusCode: 200, data };
  }

  @Delete(':groupId')
  @UseGuards(GroupOwnerGuard)
  @ApiOperation({ summary: 'Owner xóa nhóm và toàn bộ dữ liệu liên quan' })
  @ApiResponse({ status: 200, description: 'Nhóm đã được xóa' })
  @ApiResponse({ status: 401, description: 'Chưa xác thực' })
  @ApiResponse({ status: 403, description: 'Không phải owner' })
  @ApiResponse({ status: 404, description: 'Nhóm không tồn tại' })
  async deleteGroup(@Param('groupId') groupId: string) {
    await this.groupService.deleteGroup(groupId);
    return { statusCode: 200, message: 'Đã xóa nhóm' };
  }

  // ---------------------------------------------------------------------------
  // POST /groups/invites/accept — Chấp nhận lời mời (đặt trước :groupId để không bị conflict)
  // ---------------------------------------------------------------------------

  @Post('invites/accept')
  @ApiOperation({
    summary: 'Chấp nhận lời mời tham gia nhóm bằng invite token',
  })
  @ApiResponse({ status: 200, description: 'Tham gia nhóm thành công' })
  @ApiResponse({
    status: 400,
    description: 'Token không hợp lệ hoặc đã hết hạn',
  })
  @ApiResponse({ status: 401, description: 'Chưa xác thực' })
  async acceptInvite(
    @Body() dto: AcceptInviteDto,
    @CurrentUser() user: JwtPayload,
  ) {
    const data = await this.groupService.acceptInvite(
      dto,
      user.sub,
      user.email,
    );
    return {
      statusCode: 200,
      message: 'Bạn đã tham gia nhóm thành công',
      data,
    };
  }

  // ---------------------------------------------------------------------------
  // POST /groups/:groupId/invites — Mời thành viên (chỉ owner)
  // ---------------------------------------------------------------------------

  @Post(':groupId/invites')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(GroupAdminGuard)
  @ApiOperation({ summary: 'Owner/Admin gửi lời mời email tham gia nhóm' })
  @ApiResponse({ status: 201, description: 'Lời mời đã gửi' })
  @ApiResponse({
    status: 400,
    description: 'Email đã là thành viên hoặc payload không hợp lệ',
  })
  @ApiResponse({ status: 401, description: 'Chưa xác thực' })
  @ApiResponse({ status: 403, description: 'Không phải owner/admin' })
  async inviteMember(
    @Param('groupId') groupId: string,
    @Body() dto: InviteMemberDto,
    @CurrentUser() user: JwtPayload,
  ) {
    await this.groupService.inviteMember(groupId, dto, user.sub, user.email);
    return { statusCode: 201, message: 'Lời mời đã được gửi' };
  }

  // ---------------------------------------------------------------------------
  // PATCH /groups/:groupId/members/:userId/role — Đổi role thành viên
  // ---------------------------------------------------------------------------

  @Patch(':groupId/members/:userId/role')
  @UseGuards(GroupAdminGuard)
  @ApiOperation({
    summary: 'Owner/Admin đổi vai trò của thành viên trong nhóm',
  })
  @ApiResponse({
    status: 200,
    description: 'Vai trò thành viên đã được cập nhật',
  })
  @ApiResponse({
    status: 400,
    description: 'Không thể đổi vai trò của owner hoặc payload không hợp lệ',
  })
  @ApiResponse({ status: 401, description: 'Chưa xác thực' })
  @ApiResponse({ status: 403, description: 'Không phải owner/admin' })
  async updateMemberRole(
    @Param('groupId') groupId: string,
    @Param('userId') targetUserId: string,
    @Body() dto: UpdateMemberRoleDto,
  ) {
    await this.groupService.updateMemberRole(groupId, targetUserId, dto);
    return { statusCode: 200, message: 'Đã cập nhật vai trò thành viên' };
  }

  // ---------------------------------------------------------------------------
  // DELETE /groups/:groupId/invites/:inviteId — Thu hồi lời mời pending
  // ---------------------------------------------------------------------------

  @Delete(':groupId/invites/:inviteId')
  @UseGuards(GroupAdminGuard)
  @ApiOperation({ summary: 'Owner/Admin thu hồi lời mời pending' })
  @ApiResponse({ status: 200, description: 'Lời mời đã được thu hồi' })
  @ApiResponse({ status: 401, description: 'Chưa xác thực' })
  @ApiResponse({ status: 403, description: 'Không phải owner/admin' })
  @ApiResponse({ status: 404, description: 'Lời mời không tồn tại' })
  async revokeInvite(
    @Param('groupId') groupId: string,
    @Param('inviteId') inviteId: string,
  ) {
    await this.groupService.revokeInvite(groupId, inviteId);
    return { statusCode: 200, message: 'Đã thu hồi lời mời' };
  }

  // ---------------------------------------------------------------------------
  // DELETE /groups/:groupId/members/:userId — Xóa thành viên (chỉ owner/admin)
  // ---------------------------------------------------------------------------

  @Delete(':groupId/members/:userId')
  @UseGuards(GroupAdminGuard)
  @ApiOperation({
    summary: 'Owner/Admin xóa thành viên khỏi nhóm, unassign tasks liên quan',
  })
  @ApiResponse({ status: 200, description: 'Thành viên đã bị xóa' })
  @ApiResponse({
    status: 400,
    description: 'Không thể xóa owner hoặc user không phải thành viên',
  })
  @ApiResponse({ status: 401, description: 'Chưa xác thực' })
  @ApiResponse({ status: 403, description: 'Không phải owner/admin' })
  async removeMember(
    @Param('groupId') groupId: string,
    @Param('userId') targetUserId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    await this.groupService.removeMember(groupId, targetUserId, user.sub);
    return { statusCode: 200, message: 'Đã xóa thành viên khỏi nhóm' };
  }

  // ---------------------------------------------------------------------------
  // Statuses
  // ---------------------------------------------------------------------------

  @Get(':groupId/statuses')
  @UseGuards(GroupMemberGuard)
  @ApiOperation({ summary: 'Lấy danh sách statuses của nhóm theo thứ tự' })
  @ApiResponse({ status: 200, description: 'Danh sách statuses' })
  @ApiResponse({ status: 401, description: 'Chưa xác thực' })
  @ApiResponse({ status: 403, description: 'Không phải thành viên' })
  async getStatuses(@Param('groupId') groupId: string) {
    const data = await this.groupService.getStatuses(groupId);
    return { statusCode: 200, data };
  }

  @Post(':groupId/statuses')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(GroupAdminGuard)
  @ApiOperation({ summary: 'Owner/Admin tạo status mới cho nhóm' })
  @ApiResponse({ status: 201, description: 'Status tạo thành công' })
  @ApiResponse({ status: 400, description: 'Slug đã tồn tại trong nhóm' })
  @ApiResponse({ status: 401, description: 'Chưa xác thực' })
  @ApiResponse({ status: 403, description: 'Không phải owner/admin' })
  async createStatus(
    @Param('groupId') groupId: string,
    @Body() dto: CreateStatusDto,
  ) {
    const data = await this.groupService.createStatus(groupId, dto);
    return { statusCode: 201, data };
  }

  @Patch(':groupId/statuses/:statusId')
  @UseGuards(GroupAdminGuard)
  @ApiOperation({ summary: 'Owner/Admin cập nhật status' })
  @ApiResponse({ status: 200, description: 'Status đã cập nhật' })
  @ApiResponse({ status: 400, description: 'Slug mới đã tồn tại' })
  @ApiResponse({ status: 401, description: 'Chưa xác thực' })
  @ApiResponse({ status: 403, description: 'Không phải owner/admin' })
  @ApiResponse({ status: 404, description: 'Status không tồn tại' })
  async updateStatus(
    @Param('groupId') groupId: string,
    @Param('statusId') statusId: string,
    @Body() dto: UpdateStatusDto,
  ) {
    const data = await this.groupService.updateStatus(groupId, statusId, dto);
    return { statusCode: 200, data };
  }

  @Delete(':groupId/statuses/:statusId')
  @UseGuards(GroupAdminGuard)
  @ApiOperation({
    summary:
      'Owner/Admin xóa status — không được xóa status mặc định hoặc khi còn tasks',
  })
  @ApiResponse({ status: 200, description: 'Status đã xóa' })
  @ApiResponse({
    status: 400,
    description: 'Status mặc định hoặc còn tasks đang sử dụng',
  })
  @ApiResponse({ status: 401, description: 'Chưa xác thực' })
  @ApiResponse({ status: 403, description: 'Không phải owner/admin' })
  @ApiResponse({ status: 404, description: 'Status không tồn tại' })
  async deleteStatus(
    @Param('groupId') groupId: string,
    @Param('statusId') statusId: string,
  ) {
    await this.groupService.deleteStatus(groupId, statusId);
    return { statusCode: 200, message: 'Đã xóa status' };
  }

  // ---------------------------------------------------------------------------
  // Labels
  // ---------------------------------------------------------------------------

  @Get(':groupId/labels')
  @UseGuards(GroupMemberGuard)
  @ApiOperation({ summary: 'Lấy danh sách labels của nhóm' })
  @ApiResponse({ status: 200, description: 'Danh sách labels' })
  @ApiResponse({ status: 401, description: 'Chưa xác thực' })
  @ApiResponse({ status: 403, description: 'Không phải thành viên' })
  async getLabels(@Param('groupId') groupId: string) {
    const data = await this.groupService.getLabels(groupId);
    return { statusCode: 200, data };
  }

  @Post(':groupId/labels')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(GroupMemberGuard)
  @ApiOperation({ summary: 'Member tạo label mới trong nhóm' })
  @ApiResponse({ status: 201, description: 'Label tạo thành công' })
  @ApiResponse({ status: 400, description: 'Tên label đã tồn tại trong nhóm' })
  @ApiResponse({ status: 401, description: 'Chưa xác thực' })
  @ApiResponse({ status: 403, description: 'Không phải thành viên' })
  async createLabel(
    @Param('groupId') groupId: string,
    @Body() dto: CreateLabelDto,
  ) {
    const data = await this.groupService.createLabel(groupId, dto);
    return { statusCode: 201, data };
  }

  @Patch(':groupId/labels/:labelId')
  @UseGuards(GroupAdminGuard)
  @ApiOperation({ summary: 'Owner/Admin cập nhật label' })
  @ApiResponse({ status: 200, description: 'Label đã cập nhật' })
  @ApiResponse({ status: 400, description: 'Tên mới đã tồn tại' })
  @ApiResponse({ status: 401, description: 'Chưa xác thực' })
  @ApiResponse({ status: 403, description: 'Không phải owner/admin' })
  @ApiResponse({ status: 404, description: 'Label không tồn tại' })
  async updateLabel(
    @Param('groupId') groupId: string,
    @Param('labelId') labelId: string,
    @Body() dto: UpdateLabelDto,
  ) {
    const data = await this.groupService.updateLabel(groupId, labelId, dto);
    return { statusCode: 200, data };
  }

  @Delete(':groupId/labels/:labelId')
  @UseGuards(GroupAdminGuard)
  @ApiOperation({
    summary: 'Owner/Admin xóa label và toàn bộ task_labels liên quan',
  })
  @ApiResponse({
    status: 200,
    description: 'Label đã xóa, task_labels cascade-deleted',
  })
  @ApiResponse({ status: 400, description: 'labelId không hợp lệ' })
  @ApiResponse({ status: 401, description: 'Chưa xác thực' })
  @ApiResponse({ status: 403, description: 'Không phải owner/admin' })
  @ApiResponse({ status: 404, description: 'Label không tồn tại' })
  async deleteLabel(
    @Param('groupId') groupId: string,
    @Param('labelId') labelId: string,
  ) {
    await this.groupService.deleteLabel(groupId, labelId);
    return { statusCode: 200, message: 'Đã xóa nhãn' };
  }
}
