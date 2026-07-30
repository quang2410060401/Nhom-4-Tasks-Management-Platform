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
  Res,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiBadRequestResponse,
  ApiConsumes,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { FilesInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtPayload } from '../../common/types/jwt-payload.type';
import { GroupMemberGuard } from '../group/guards/group-member.guard';
import { TaskService } from './task.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { ListTaskQueryDto } from './dto/list-task-query.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { CreateTaskCommentDto } from './dto/create-task-comment.dto';
import { UpdateTaskCommentDto } from './dto/update-task-comment.dto';
import type { UploadedTaskFile } from './task-upload.types';

interface AttachmentResponseHeaders {
  setHeader(name: string, value: string): void;
  end(body: Buffer): void;
  redirect(url: string): void;
}

@ApiTags('Tasks')
@ApiBearerAuth()
@ApiUnauthorizedResponse({
  description: 'Token không được cung cấp hoặc không hợp lệ',
})
@ApiForbiddenResponse({ description: 'Không phải thành viên của nhóm' })
@UseGuards(JwtAuthGuard)
@Controller('groups/:groupId/tasks')
export class TaskController {
  private readonly logger = new Logger(TaskController.name);

  constructor(private readonly taskService: TaskService) {}

  // POST /groups/:groupId/tasks
  @Post()
  @UseGuards(GroupMemberGuard)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Tạo task mới trong nhóm' })
  @ApiCreatedResponse({ description: 'Tạo thành công, trả về task vừa tạo' })
  @ApiBadRequestResponse({
    description:
      'statusId không thuộc group | assigneeId không phải member | deadline trong quá khứ | labelId không thuộc group',
  })
  async createTask(
    @Param('groupId') groupId: string,
    @Body() dto: CreateTaskDto,
    @CurrentUser() user: JwtPayload,
  ) {
    const result = await this.taskService.createTask(groupId, dto, user.sub);
    return { statusCode: HttpStatus.CREATED, data: result };
  }

  // GET /groups/:groupId/tasks — Kanban board (tasks grouped by status)
  @Get()
  @UseGuards(GroupMemberGuard)
  @ApiOperation({ summary: 'Lấy Kanban board — tasks grouped by status' })
  @ApiOkResponse({
    description: 'Tất cả statuses kèm tasks (cột rỗng vẫn được trả về)',
  })
  async getKanbanTasks(
    @Param('groupId') groupId: string,
    @Query() query: ListTaskQueryDto,
  ) {
    const result = await this.taskService.getKanbanTasks(groupId, query);
    return { statusCode: HttpStatus.OK, data: result };
  }

  @Get('list')
  @UseGuards(GroupMemberGuard)
  @ApiOperation({ summary: 'Lấy danh sách công việc dạng phẳng cho list view' })
  @ApiOkResponse({ description: 'Danh sách công việc đã map kèm metadata trạng thái' })
  async getTaskList(
    @Param('groupId') groupId: string,
    @Query() query: ListTaskQueryDto,
  ) {
    const result = await this.taskService.getTaskList(groupId, query);
    return { statusCode: HttpStatus.OK, data: result };
  }

  // PATCH /groups/:groupId/tasks/:taskId
  @Patch(':taskId')
  @UseGuards(GroupMemberGuard)
  @ApiOperation({ summary: 'Cập nhật task (partial update)' })
  @ApiOkResponse({ description: 'Task sau khi cập nhật, đã populate đầy đủ' })
  @ApiBadRequestResponse({
    description:
      'deadline trong quá khứ | statusId/assigneeId/labelId không hợp lệ',
  })
  @ApiNotFoundResponse({ description: 'Task không tồn tại' })
  async updateTask(
    @Param('groupId') groupId: string,
    @Param('taskId') taskId: string,
    @Body() dto: UpdateTaskDto,
  ) {
    const result = await this.taskService.updateTask(groupId, taskId, dto);
    return { statusCode: HttpStatus.OK, data: result };
  }

  // DELETE /groups/:groupId/tasks/:taskId
  @Delete(':taskId')
  @UseGuards(GroupMemberGuard)
  @ApiOperation({ summary: 'Xóa task (chỉ owner hoặc admin)' })
  @ApiOkResponse({ description: 'Xóa thành công' })
  @ApiForbiddenResponse({ description: 'Không đủ quyền xóa task này' })
  @ApiNotFoundResponse({ description: 'Task không tồn tại' })
  async deleteTask(
    @Param('groupId') groupId: string,
    @Param('taskId') taskId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    await this.taskService.deleteTask(groupId, taskId, user.sub);
    return { statusCode: HttpStatus.OK, message: 'Xóa task thành công' };
  }

  // GET /groups/:groupId/tasks/:taskId
  @Get(':taskId')
  @UseGuards(GroupMemberGuard)
  @ApiOperation({ summary: 'Lấy chi tiết một task' })
  @ApiOkResponse({ description: 'Chi tiết task kèm status, assignee, labels' })
  @ApiNotFoundResponse({ description: 'Task không tồn tại' })
  async getTaskDetail(
    @Param('groupId') groupId: string,
    @Param('taskId') taskId: string,
  ) {
    const result = await this.taskService.getTaskDetail(groupId, taskId);
    return { statusCode: HttpStatus.OK, data: result };
  }

  @Get(':taskId/comments')
  @UseGuards(GroupMemberGuard)
  @ApiOperation({ summary: 'Lấy danh sách bình luận của task' })
  @ApiOkResponse({ description: 'Danh sách bình luận text-only của task' })
  async getTaskComments(
    @Param('groupId') groupId: string,
    @Param('taskId') taskId: string,
  ) {
    const result = await this.taskService.getTaskComments(groupId, taskId);
    return { statusCode: HttpStatus.OK, data: result };
  }

  @Post(':taskId/comments')
  @UseGuards(GroupMemberGuard)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Tạo bình luận cho task' })
  @ApiCreatedResponse({ description: 'Tạo bình luận thành công' })
  async createTaskComment(
    @Param('groupId') groupId: string,
    @Param('taskId') taskId: string,
    @Body() dto: CreateTaskCommentDto,
    @CurrentUser() user: JwtPayload,
  ) {
    const result = await this.taskService.createTaskComment(
      groupId,
      taskId,
      dto,
      user.sub,
    );
    return { statusCode: HttpStatus.CREATED, data: result };
  }

  @Patch(':taskId/comments/:commentId')
  @UseGuards(GroupMemberGuard)
  @ApiOperation({ summary: 'Cập nhật bình luận của task' })
  @ApiOkResponse({ description: 'Cập nhật bình luận thành công' })
  async updateTaskComment(
    @Param('groupId') groupId: string,
    @Param('taskId') taskId: string,
    @Param('commentId') commentId: string,
    @Body() dto: UpdateTaskCommentDto,
    @CurrentUser() user: JwtPayload,
  ) {
    const result = await this.taskService.updateTaskComment(
      groupId,
      taskId,
      commentId,
      dto,
      user.sub,
    );
    return { statusCode: HttpStatus.OK, data: result };
  }

  @Delete(':taskId/comments/:commentId')
  @UseGuards(GroupMemberGuard)
  @ApiOperation({ summary: 'Xóa bình luận của task' })
  @ApiOkResponse({ description: 'Xóa bình luận thành công' })
  async deleteTaskComment(
    @Param('groupId') groupId: string,
    @Param('taskId') taskId: string,
    @Param('commentId') commentId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    await this.taskService.deleteTaskComment(
      groupId,
      taskId,
      commentId,
      user.sub,
    );
    return { statusCode: HttpStatus.OK, message: 'Xóa bình luận thành công' };
  }

  @Post(':taskId/attachments')
  @UseGuards(GroupMemberGuard)
  @UseInterceptors(FilesInterceptor('files', 10))
  @HttpCode(HttpStatus.CREATED)
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Tải tệp đính kèm cho task' })
  @ApiCreatedResponse({ description: 'Tải tệp đính kèm thành công' })
  async uploadTaskAttachments(
    @Param('groupId') groupId: string,
    @Param('taskId') taskId: string,
    @UploadedFiles() files: UploadedTaskFile[],
    @CurrentUser() user: JwtPayload,
  ) {
    const result = await this.taskService.uploadTaskAttachments(
      groupId,
      taskId,
      files ?? [],
      user.sub,
    );
    return { statusCode: HttpStatus.CREATED, data: result };
  }

  @Get(':taskId/attachments/:attachmentId')
  @UseGuards(GroupMemberGuard)
  @ApiOperation({ summary: 'Tải xuống tệp đính kèm của task' })
  async downloadTaskAttachment(
    @Param('groupId') groupId: string,
    @Param('taskId') taskId: string,
    @Param('attachmentId') attachmentId: string,
    @Res() res: AttachmentResponseHeaders,
  ) {
    const file = await this.taskService.getTaskAttachmentFile(
      groupId,
      taskId,
      attachmentId,
    );

    if (file.redirectUrl) {
      res.redirect(file.redirectUrl);
      return;
    }

    res.setHeader('Content-Type', file.mimeType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(file.originalName)}"`,
    );
    res.setHeader('Content-Length', String(file.size));

    res.end(file.buffer);
  }

  @Delete(':taskId/attachments/:attachmentId')
  @UseGuards(GroupMemberGuard)
  @ApiOperation({ summary: 'Xóa tệp đính kèm của task' })
  @ApiOkResponse({ description: 'Xóa tệp đính kèm thành công' })
  async deleteTaskAttachment(
    @Param('groupId') groupId: string,
    @Param('taskId') taskId: string,
    @Param('attachmentId') attachmentId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    await this.taskService.deleteTaskAttachment(
      groupId,
      taskId,
      attachmentId,
      user.sub,
    );
    return {
      statusCode: HttpStatus.OK,
      message: 'Xóa tệp đính kèm thành công',
    };
  }
}
