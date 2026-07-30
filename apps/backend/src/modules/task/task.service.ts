import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import path from 'node:path';
import { ClientSession, isValidObjectId, Model, Types } from 'mongoose';
import { Task, TaskDocument } from './schemas/task.schema';
import { TaskLabel, TaskLabelDocument } from './schemas/task-label.schema';
import {
  TaskComment,
  TaskCommentDocument,
} from './schemas/task-comment.schema';
import {
  TaskAttachment,
  TaskAttachmentDocument,
} from './schemas/task-attachment.schema';
import { Status, StatusDocument } from '../group/schemas/status.schema';
import { Label, LabelDocument } from '../group/schemas/label.schema';
import { Group, GroupDocument } from '../group/schemas/group.schema';
import {
  GroupMember,
  GroupMemberDocument,
} from '../group/schemas/group-member.schema';
import { User, UserDocument } from '../auth/schemas/user.schema';
import { CreateTaskDto } from './dto/create-task.dto';
import { ListMyTaskQueryDto } from './dto/list-my-task-query.dto';
import { ListTaskQueryDto } from './dto/list-task-query.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { CreateTaskCommentDto } from './dto/create-task-comment.dto';
import { UpdateTaskCommentDto } from './dto/update-task-comment.dto';
import { GroupRole } from '../group/enums/group-role.enum';
import {
  AssigneeRef,
  CreateTaskResult,
  CreatorRef,
  KanbanResult,
  LabelRef,
  StatusRef,
  TaskListResult,
  TaskAttachmentResult,
  TaskCommentResult,
  TaskDetailResult,
  MyTaskListResult,
} from './task.types';
import {
  TASK_ATTACHMENT_ALLOWED_EXTENSIONS,
  TASK_ATTACHMENT_ALLOWED_MIME_TYPES,
  TASK_ATTACHMENT_MAX_FILES,
  TASK_ATTACHMENT_MAX_SIZE,
  TASK_ERRORS,
} from './task.constants';
import {
  normalizeTaskCommentContent,
  sanitizeTaskDescriptionHtml,
} from './utils/task-rich-text.utils';
import { TaskFileStorageService } from './services/task-file-storage.service';
import type { UploadedTaskFile } from './task-upload.types';
import {
  objectIdsEqual,
  toObjectId,
} from '../../common/utils/object-id.util';

@Injectable()
export class TaskService {
  private readonly logger = new Logger(TaskService.name);

  constructor(
    @InjectModel(Task.name) private readonly taskModel: Model<TaskDocument>,
    @InjectModel(TaskLabel.name)
    private readonly taskLabelModel: Model<TaskLabelDocument>,
    @InjectModel(TaskComment.name)
    private readonly taskCommentModel: Model<TaskCommentDocument>,
    @InjectModel(TaskAttachment.name)
    private readonly taskAttachmentModel: Model<TaskAttachmentDocument>,
    @InjectModel(Group.name) private readonly groupModel: Model<GroupDocument>,
    @InjectModel(Status.name)
    private readonly statusModel: Model<StatusDocument>,
    @InjectModel(Label.name) private readonly labelModel: Model<LabelDocument>,
    @InjectModel(GroupMember.name)
    private readonly groupMemberModel: Model<GroupMemberDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    private readonly taskFileStorageService: TaskFileStorageService,
  ) {}

  // ---------------------------------------------------------------------------
  // POST /groups/:groupId/tasks — Tạo task mới
  // ---------------------------------------------------------------------------

  /**
   * Tạo task mới trong một nhóm.
   *
   * Luồng xử lý:
   * 1. Resolve statusId → nếu không truyền, lấy default status của group
   * 2. Validate statusId thuộc cùng groupId
   * 3. Validate assigneeId là member của group (nếu có)
   * 4. Validate deadline > now (nếu có)
   * 5. Validate tất cả labelIds thuộc cùng groupId (nếu có)
   * 6. Transaction: tạo task + insert task_labels
   * 7. Build và trả về response đã populate
   *
   * Validation errors đều trả trước khi vào transaction để giảm retry overhead.
   */
  async createTask(
    groupId: string,
    dto: CreateTaskDto,
    creatorId: string,
  ): Promise<CreateTaskResult> {
    // groupId đến từ route param — validate format sớm để tránh BSONTypeError → 500
    if (!isValidObjectId(groupId)) {
      throw new NotFoundException('Nhóm không tồn tại');
    }
    const groupObjectId = toObjectId(groupId);
    const creatorObjectId = toObjectId(creatorId);
    const title = this._normalizeTaskTitle(dto.title);
    const description = this._normalizeTaskDescription(dto.description);

    // ── Bước 1 & 2: Resolve và validate statusId ─────────────────────────────
    const resolvedStatus = await this._resolveStatus(
      groupObjectId,
      dto.statusId,
    );

    // ── Bước 3: Validate assigneeId là member của group ──────────────────────
    let assigneeUser: {
      _id: Types.ObjectId;
      name: string;
      avatar: string | null;
    } | null = null;
    if (dto.assigneeId) {
      assigneeUser = await this._validateAssignee(
        groupObjectId,
        dto.assigneeId,
      );
    }

    // ── Bước 4: Validate deadline > now ──────────────────────────────────────
    let deadlineDate: Date | null = null;
    if (dto.deadline) {
      deadlineDate = new Date(dto.deadline);
      if (deadlineDate <= new Date()) {
        throw new BadRequestException(TASK_ERRORS.DEADLINE_IN_PAST);
      }
    }

    // ── Bước 5: Validate và load tất cả labels thuộc cùng group ──────────────
    const labelIds = this._dedupeIds(dto.labelIds ?? []);
    const resolvedLabels = await this._resolveLabels(groupObjectId, labelIds);

    // ── Bước 6: Transaction — tạo task + insert task_labels ──────────────────
    let taskDoc!: TaskDocument;

    try {
      await this._runWithOptionalTransaction(async (session) => {
        // Tạo task document
        const [created] = await this.taskModel.create(
          [
            {
              title,
              description,
              groupId: groupObjectId,
              statusId: resolvedStatus._id,
              assigneeId: assigneeUser
                ? toObjectId(dto.assigneeId!)
                : null,
              creatorId: creatorObjectId,
              deadline: deadlineDate,
              reminderSentAt: null,
              overdueSentAt: null,
            },
          ],
          session ? { session } : undefined,
        );
        taskDoc = created;

        // Insert task_labels nếu có labels
        if (resolvedLabels.length > 0) {
          const taskLabels = resolvedLabels.map((l) => ({
            taskId: taskDoc._id,
            labelId: toObjectId(l._id),
          }));

          if (session) {
            await this.taskLabelModel.insertMany(taskLabels, { session });
          } else {
            await this.taskLabelModel.insertMany(taskLabels);
          }
        }
      });

      this.logger.log(
        `Task "${taskDoc.title}" (${taskDoc._id.toString()}) tạo thành công trong nhóm ${groupId} bởi user ${creatorId}`,
      );
    } catch (error) {
      this.logger.error(`Tạo task thất bại trong nhóm ${groupId}`, error);
      throw new InternalServerErrorException(
        'Tạo task thất bại, vui lòng thử lại',
      );
    }

    // ── Bước 7: Build response từ dữ liệu đã có, không query lại DB ────────────
    const createdAt = (taskDoc as unknown as { createdAt: Date }).createdAt;

    return {
      _id: taskDoc._id.toString(),
      title,
      description,
      groupId: groupId,
      statusId: resolvedStatus._id.toString(),
      status: {
        _id: resolvedStatus._id.toString(),
        name: resolvedStatus.name,
        color: resolvedStatus.color,
      },
      assigneeId: assigneeUser ? assigneeUser._id.toString() : null,
      assignee: assigneeUser
        ? {
            _id: assigneeUser._id.toString(),
            name: assigneeUser.name,
            avatar: assigneeUser.avatar,
          }
        : null,
      creatorId: creatorId,
      deadline: taskDoc.deadline,
      labels: resolvedLabels.map((l) => ({
        _id: l._id.toString(),
        name: l.name,
        color: l.color,
      })),
      createdAt,
    };
  }

  // ---------------------------------------------------------------------------
  // GET /groups/:groupId/tasks/:taskId — Chi tiết task
  // ---------------------------------------------------------------------------

  /**
   * Lấy chi tiết một task, kèm status, assignee, creator, labels đã populate.
   * Đảm bảo task thuộc đúng groupId (chặn cross-group access).
   */
  async getTaskDetail(
    groupId: string,
    taskId: string,
  ): Promise<TaskDetailResult> {
    // Validate cả hai param trước khi truyền vào ObjectId constructor
    if (!isValidObjectId(groupId) || !isValidObjectId(taskId)) {
      throw new NotFoundException(TASK_ERRORS.NOT_FOUND);
    }

    const groupObjectId = toObjectId(groupId);
    const taskObjectId = toObjectId(taskId);

    // Tìm task và đảm bảo thuộc đúng group này — ngăn cross-group data leak
    const task = await this.taskModel
      .findOne({ _id: taskObjectId, groupId: groupObjectId })
      .lean()
      .exec();

    if (!task) {
      throw new NotFoundException(TASK_ERRORS.NOT_FOUND);
    }

    // Chạy song song: status, assignee user, creator user, task_labels
    const [
      status,
      assigneeUser,
      creatorUser,
      taskLabelDocs,
      attachments,
      commentCount,
    ] = await Promise.all([
      this.statusModel
        .findById(task.statusId)
        .select({ name: 1, color: 1 })
        .lean()
        .exec(),

      task.assigneeId
        ? this.userModel
            .findById(task.assigneeId)
            .select({ name: 1, avatar: 1 })
            .lean()
            .exec()
        : Promise.resolve(null),

      this.userModel.findById(task.creatorId).select({ name: 1 }).lean().exec(),

      // Lấy tất cả task_labels rồi join labels: tránh N+1
      this.taskLabelModel.find({ taskId: taskObjectId }).lean().exec(),
      this.taskAttachmentModel
        .find({ taskId: taskObjectId, groupId: groupObjectId })
        .sort({ createdAt: -1 })
        .lean()
        .exec(),
      this.taskCommentModel.countDocuments({
        taskId: taskObjectId,
        groupId: groupObjectId,
      }),
    ]);

    // Lấy thông tin labels từ danh sách labelIds trong task_labels
    const labelObjectIds = taskLabelDocs.map((tl) => tl.labelId);
    const labels =
      labelObjectIds.length > 0
        ? await this.labelModel
            .find({ _id: { $in: labelObjectIds } })
            .select({ name: 1, color: 1 })
            .lean()
            .exec()
        : [];

    // Build response — không trả raw document, chỉ các fields theo API spec
    const taskAny = task as unknown as { createdAt: Date; updatedAt: Date };

    const statusRef: StatusRef = status
      ? { _id: status._id.toString(), name: status.name, color: status.color }
      : { _id: task.statusId.toString(), name: '', color: '' };

    const assigneeRef: AssigneeRef | null = assigneeUser
      ? {
          _id: assigneeUser._id.toString(),
          name: assigneeUser.name,
          avatar: assigneeUser.avatar ?? null,
        }
      : null;

    const creatorRef: CreatorRef = {
      _id: task.creatorId.toString(),
      name: creatorUser?.name ?? '',
    };

    const labelRefs: LabelRef[] = labels.map((l) => ({
      _id: l._id.toString(),
      name: l.name,
      color: l.color,
    }));
    const attachmentRefs = await this._mapAttachments(attachments);

    return {
      _id: task._id.toString(),
      title: task.title,
      description: task.description,
      groupId: groupId,
      status: statusRef,
      assignee: assigneeRef,
      creator: creatorRef,
      deadline: task.deadline,
      labels: labelRefs,
      attachments: attachmentRefs,
      commentCount,
      reminderSentAt: task.reminderSentAt,
      overdueSentAt: task.overdueSentAt,
      createdAt: taskAny.createdAt,
      updatedAt: taskAny.updatedAt,
    };
  }

  async getTaskComments(
    groupId: string,
    taskId: string,
  ): Promise<TaskCommentResult[]> {
    const { groupObjectId, taskObjectId } = this._buildTaskObjectIds(
      groupId,
      taskId,
    );
    await this._ensureTaskExists(groupObjectId, taskObjectId);

    const comments = await this.taskCommentModel
      .find({ groupId: groupObjectId, taskId: taskObjectId })
      .sort({ createdAt: 1 })
      .lean()
      .exec();

    return this._mapComments(comments);
  }

  async createTaskComment(
    groupId: string,
    taskId: string,
    dto: CreateTaskCommentDto,
    userId: string,
  ): Promise<TaskCommentResult> {
    const { groupObjectId, taskObjectId } = this._buildTaskObjectIds(
      groupId,
      taskId,
    );
    const authorObjectId = toObjectId(userId);
    await this._ensureTaskExists(groupObjectId, taskObjectId);

    const content = this._normalizeTaskComment(dto.content);

    const [comment] = await this.taskCommentModel.create([
      {
        taskId: taskObjectId,
        groupId: groupObjectId,
        authorId: authorObjectId,
        content,
      },
    ]);

    const comments = await this._mapComments([comment.toObject()]);
    return comments[0];
  }

  async updateTaskComment(
    groupId: string,
    taskId: string,
    commentId: string,
    dto: UpdateTaskCommentDto,
    userId: string,
  ): Promise<TaskCommentResult> {
    if (!isValidObjectId(commentId)) {
      throw new NotFoundException(TASK_ERRORS.COMMENT_NOT_FOUND);
    }

    const { groupObjectId, taskObjectId } = this._buildTaskObjectIds(
      groupId,
      taskId,
    );
    await this._ensureTaskExists(groupObjectId, taskObjectId);

    const commentObjectId = toObjectId(commentId);
    const requesterObjectId = toObjectId(userId);
    const comment = await this.taskCommentModel
      .findOne({
        _id: commentObjectId,
        taskId: taskObjectId,
        groupId: groupObjectId,
      })
      .lean()
      .exec();

    if (!comment) {
      throw new NotFoundException(TASK_ERRORS.COMMENT_NOT_FOUND);
    }

    if (!objectIdsEqual(comment.authorId, requesterObjectId)) {
      throw new ForbiddenException(TASK_ERRORS.COMMENT_FORBIDDEN);
    }

    const content = this._normalizeTaskComment(dto.content);
    if (content === comment.content) {
      const comments = await this._mapComments([comment]);
      return comments[0];
    }

    await this.taskCommentModel.updateOne(
      { _id: commentObjectId },
      { $set: { content } },
    );

    const updated = await this.taskCommentModel
      .findById(commentObjectId)
      .lean()
      .exec();
    if (!updated) {
      throw new NotFoundException(TASK_ERRORS.COMMENT_NOT_FOUND);
    }

    const comments = await this._mapComments([updated]);
    return comments[0];
  }

  async deleteTaskComment(
    groupId: string,
    taskId: string,
    commentId: string,
    userId: string,
  ): Promise<void> {
    if (!isValidObjectId(commentId)) {
      throw new NotFoundException(TASK_ERRORS.COMMENT_NOT_FOUND);
    }

    const { groupObjectId, taskObjectId } = this._buildTaskObjectIds(
      groupId,
      taskId,
    );
    const requesterObjectId = toObjectId(userId);
    await this._ensureTaskExists(groupObjectId, taskObjectId);

    const commentObjectId = toObjectId(commentId);
    const comment = await this.taskCommentModel
      .findOne({
        _id: commentObjectId,
        taskId: taskObjectId,
        groupId: groupObjectId,
      })
      .select({ authorId: 1 })
      .lean()
      .exec();

    if (!comment) {
      throw new NotFoundException(TASK_ERRORS.COMMENT_NOT_FOUND);
    }

    if (!objectIdsEqual(comment.authorId, requesterObjectId)) {
      const membershipRole = await this._getMembershipRole(
        groupObjectId,
        requesterObjectId,
      );
      if (!this._isManagerRole(membershipRole)) {
        throw new ForbiddenException(TASK_ERRORS.COMMENT_DELETE_FORBIDDEN);
      }
    }

    await this.taskCommentModel.deleteOne({ _id: commentObjectId });
  }

  async uploadTaskAttachments(
    groupId: string,
    taskId: string,
    files: UploadedTaskFile[],
    userId: string,
  ): Promise<TaskAttachmentResult[]> {
    const { groupObjectId, taskObjectId } = this._buildTaskObjectIds(
      groupId,
      taskId,
    );
    const uploaderObjectId = toObjectId(userId);
    await this._ensureTaskExists(groupObjectId, taskObjectId);

    if (files.length === 0) {
      throw new BadRequestException(TASK_ERRORS.ATTACHMENT_EMPTY);
    }

    const existingCount = await this.taskAttachmentModel.countDocuments({
      taskId: taskObjectId,
      groupId: groupObjectId,
    });

    if (existingCount + files.length > TASK_ATTACHMENT_MAX_FILES) {
      throw new BadRequestException(TASK_ERRORS.ATTACHMENT_LIMIT);
    }

    files.forEach((file) => this._validateAttachmentFile(file));

    const storedFiles: Array<{
      storedName: string;
      relativePath: string;
      absolutePath: string;
      file: UploadedTaskFile;
    }> = [];

    try {
      for (const file of files) {
        const stored = await this.taskFileStorageService.saveFile(
          groupId,
          taskId,
          file,
        );
        storedFiles.push({ ...stored, file });
      }

      const created = await this.taskAttachmentModel.insertMany(
        storedFiles.map(({ storedName, relativePath, file }) => ({
          taskId: taskObjectId,
          groupId: groupObjectId,
          uploadedBy: uploaderObjectId,
          originalName: this._normalizeFileName(file.originalname),
          storedName,
          relativePath,
          mimeType: file.mimetype,
          size: file.size,
        })),
      );

      return this._mapAttachments(created.map((item) => item.toObject()));
    } catch (error) {
      await Promise.all(
        storedFiles.map((stored) =>
          this.taskFileStorageService.deleteFile(stored.relativePath),
        ),
      );
      this.logger.error(`Tải tệp đính kèm thất bại cho task ${taskId}`, error);
      throw new InternalServerErrorException(
        'Tải tệp đính kèm thất bại, vui lòng thử lại',
      );
    }
  }

  async getTaskAttachmentFile(
    groupId: string,
    taskId: string,
    attachmentId: string,
  ): Promise<{
    redirectUrl: string | null;
    buffer: Buffer;
    mimeType: string;
    originalName: string;
    size: number;
  }> {
    if (!isValidObjectId(attachmentId)) {
      throw new NotFoundException(TASK_ERRORS.ATTACHMENT_NOT_FOUND);
    }

    const { groupObjectId, taskObjectId } = this._buildTaskObjectIds(
      groupId,
      taskId,
    );
    await this._ensureTaskExists(groupObjectId, taskObjectId);

    const attachment = await this.taskAttachmentModel
      .findOne({
        _id: toObjectId(attachmentId),
        taskId: taskObjectId,
        groupId: groupObjectId,
      })
      .lean()
      .exec();

    if (!attachment) {
      throw new NotFoundException(TASK_ERRORS.ATTACHMENT_NOT_FOUND);
    }

    const redirectUrl = await this.taskFileStorageService.getPublicFileUrl(
      attachment.relativePath,
    );
    const buffer = redirectUrl
      ? Buffer.alloc(0)
      : await this.taskFileStorageService.readFileBuffer(attachment.relativePath);

    return {
      redirectUrl,
      buffer,
      mimeType: attachment.mimeType,
      originalName: attachment.originalName,
      size: attachment.size,
    };
  }

  async deleteTaskAttachment(
    groupId: string,
    taskId: string,
    attachmentId: string,
    userId: string,
  ): Promise<void> {
    if (!isValidObjectId(attachmentId)) {
      throw new NotFoundException(TASK_ERRORS.ATTACHMENT_NOT_FOUND);
    }

    const { groupObjectId, taskObjectId } = this._buildTaskObjectIds(
      groupId,
      taskId,
    );
    const requesterObjectId = toObjectId(userId);
    await this._ensureTaskExists(groupObjectId, taskObjectId);

    const attachment = await this.taskAttachmentModel
      .findOne({
        _id: toObjectId(attachmentId),
        taskId: taskObjectId,
        groupId: groupObjectId,
      })
      .lean()
      .exec();

    if (!attachment) {
      throw new NotFoundException(TASK_ERRORS.ATTACHMENT_NOT_FOUND);
    }

    if (!objectIdsEqual(attachment.uploadedBy, requesterObjectId)) {
      const membershipRole = await this._getMembershipRole(
        groupObjectId,
        requesterObjectId,
      );
      if (!this._isManagerRole(membershipRole)) {
        throw new ForbiddenException(TASK_ERRORS.ATTACHMENT_FORBIDDEN);
      }
    }

    await this.taskAttachmentModel.deleteOne({ _id: attachment._id });
    await this.taskFileStorageService.deleteFile(attachment.relativePath);
  }

  // ---------------------------------------------------------------------------
  // GET /groups/:groupId/tasks — Kanban board
  // ---------------------------------------------------------------------------

  /**
   * Lấy danh sách tasks của group được nhóm theo status (Kanban view).
   *
   * Luồng xử lý (tối ưu để tránh N+1):
   * 1. Load tất cả statuses của group (sorted by order) — 1 query
   * 2. Xây dựng task filter (groupId + optional: assigneeId, search, labelIds)
   *    - labelIds filter: dùng distinct trên task_labels để lấy matching taskIds
   * 3. Load tất cả tasks khớp filter — 1 query
   * 4. Load task_labels + assignee users song song — 2 queries
   * 5. Load labels từ labelIds thu thập được — 1 query
   * 6. Xây dựng lookup maps (O(1) lookup) rồi phân phối tasks vào status buckets
   * 7. Trả về tất cả statuses kể cả cột rỗng — đảm bảo stable Kanban layout
   */
  async getKanbanTasks(
    groupId: string,
    query: ListTaskQueryDto,
  ): Promise<KanbanResult> {
    if (!isValidObjectId(groupId)) {
      // groupId không hợp lệ → không bao giờ có status nào → trả board rỗng an toàn
      return { statuses: [] };
    }
    const groupObjectId = toObjectId(groupId);

    // ── Bước 1: Load tất cả statuses, sắp xếp theo order ─────────────────────
    const statuses = (
      await this.statusModel
        .find({ groupId: groupObjectId })
        .sort({ order: 1 })
        .lean()
        .exec()
    ).sort(
      (left, right) =>
        Number(left.isCompleted) - Number(right.isCompleted) ||
        left.order - right.order,
    );

    // ── Bước 2: Xây dựng filter cho tasks ────────────────────────────────────
    const taskFilter: Record<string, unknown> = { groupId: groupObjectId };

    // Filter theo assigneeId/assigneeIds — hỗ trợ backward compatibility với query cũ
    const assigneeIds = Array.from(
      new Set(
        [
          ...(query.assigneeIds ?? []),
          ...(query.assigneeId ? [query.assigneeId] : []),
        ].filter(Boolean),
      ),
    );

    if (assigneeIds.length > 0) {
      taskFilter.assigneeId = {
        $in: assigneeIds.map((id) => toObjectId(id)),
      };
    }

    if (query.statusIds && query.statusIds.length > 0) {
      taskFilter.statusId = {
        $in: query.statusIds.map((id) => toObjectId(id)),
      };
    }

    // Filter theo search — case-insensitive partial match trên title
    // Escape ký tự đặc biệt trong regex để ngăn ReDoS injection
    if (query.search) {
      const escaped = query.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      taskFilter.title = { $regex: escaped, $options: 'i' };
    }

    // Filter theo labelIds — task phải có ít nhất một label trong danh sách (OR logic)
    // Dùng distinct để lấy danh sách unique taskIds khớp, sau đó scope lại bằng groupId
    if (query.labelIds && query.labelIds.length > 0) {
      const filterLabelObjectIds = query.labelIds.map(
        (id) => toObjectId(id),
      );
      const matchingTaskIds = await this.taskLabelModel
        .distinct('taskId', { labelId: { $in: filterLabelObjectIds } })
        .exec();
      taskFilter._id = { $in: matchingTaskIds };
    }

    if (query.dateFrom || query.dateTo) {
      const deadlineFilter: Record<string, Date> = {};

      if (query.dateFrom) {
        deadlineFilter.$gte = new Date(query.dateFrom);
      }
      if (query.dateTo) {
        deadlineFilter.$lte = new Date(query.dateTo);
      }

      taskFilter.deadline = deadlineFilter;
    }

    // ── Bước 3: Load tất cả tasks matching filter — 1 query duy nhất ─────────
    const tasks = await this.taskModel
      .find(taskFilter)
      .sort({ createdAt: 1 }) // Cũ nhất lên trên trong mỗi cột
      .lean()
      .exec();

    // Tối ưu early return: không có task → trả ngay với mảng rỗng, tiết kiệm 3 queries
    if (tasks.length === 0) {
      return {
        statuses: statuses.map((s) => ({
          _id: s._id.toString(),
          name: s.name,
          slug: s.slug,
          color: s.color,
          order: s.order,
          isCompleted: s.isCompleted,
          tasks: [],
        })),
      };
    }

    const taskIds = tasks.map((t) => t._id);

    // Deduplicate assigneeIds để tránh load cùng 1 user nhiều lần
    const assigneeIdStrings = [
      ...new Set(
        tasks
          .filter((t) => t.assigneeId != null)
          .map((t) => t.assigneeId!.toString()),
      ),
    ];
    const assigneeObjectIds = assigneeIdStrings.map(
      (id) => toObjectId(id),
    );

    // ── Bước 4: Load task_labels + assignee users song song — 2 queries ───────
    const [taskLabelDocs, assigneeUsers] = await Promise.all([
      // Tất cả task_labels của các tasks trong kết quả — 1 round trip
      this.taskLabelModel
        .find({ taskId: { $in: taskIds } })
        .lean()
        .exec(),

      // Tất cả assignee users duy nhất — 1 round trip thay vì N
      assigneeObjectIds.length > 0
        ? this.userModel
            .find({ _id: { $in: assigneeObjectIds } })
            .select({ name: 1, avatar: 1 })
            .lean()
            .exec()
        : Promise.resolve([]),
    ]);

    // ── Bước 5: Load labels từ task_label join docs — 1 query ─────────────────
    const allLabelIdStrings = [
      ...new Set(taskLabelDocs.map((tl) => tl.labelId.toString())),
    ];
    const allLabelObjectIds = allLabelIdStrings.map(
      (id) => toObjectId(id),
    );

    const labels =
      allLabelObjectIds.length > 0
        ? await this.labelModel
            .find({ _id: { $in: allLabelObjectIds } })
            .select({ name: 1, color: 1 })
            .lean()
            .exec()
        : [];

    // ── Bước 6: Xây dựng lookup maps — tra cứu O(1) khi build response ────────
    // Map: userId → user doc
    const assigneeMap = new Map(
      assigneeUsers.map((u) => [u._id.toString(), u]),
    );

    // Map: labelId → label doc
    const labelMap = new Map(labels.map((l) => [l._id.toString(), l]));

    // Map: taskId → LabelRef[] — gom tất cả labels của từng task
    const taskLabelsMap = new Map<string, LabelRef[]>();
    for (const tl of taskLabelDocs) {
      const key = tl.taskId.toString();
      if (!taskLabelsMap.has(key)) taskLabelsMap.set(key, []);
      const labelDoc = labelMap.get(tl.labelId.toString());
      if (labelDoc) {
        taskLabelsMap.get(key)!.push({
          _id: labelDoc._id.toString(),
          name: labelDoc.name,
          color: labelDoc.color,
        });
      }
    }

    // ── Bước 7: Khởi tạo status buckets và phân phối tasks — O(n) ────────────
    // Mỗi status có sẵn bucket rỗng → đảm bảo tất cả statuses đều xuất hiện
    const statusTasksMap = new Map<
      string,
      KanbanResult['statuses'][number]['tasks']
    >();
    for (const s of statuses) {
      statusTasksMap.set(s._id.toString(), []);
    }

    for (const task of tasks) {
      const statusKey = task.statusId.toString();
      if (!statusTasksMap.has(statusKey)) continue; // Task có statusId không còn tồn tại — bỏ qua

      const taskAny = task as unknown as { createdAt: Date };
      const assigneeDoc = task.assigneeId
        ? assigneeMap.get(task.assigneeId.toString())
        : undefined;

      statusTasksMap.get(statusKey)!.push({
        _id: task._id.toString(),
        title: task.title,
        description: task.description,
        assignee: assigneeDoc
          ? {
              _id: assigneeDoc._id.toString(),
              name: assigneeDoc.name,
              avatar: (assigneeDoc as { avatar?: string }).avatar ?? null,
            }
          : null,
        deadline: task.deadline,
        labels: taskLabelsMap.get(task._id.toString()) ?? [],
        createdAt: taskAny.createdAt,
      });
    }

    // ── Bước 8: Build final response — tất cả statuses kể cả cột rỗng ─────────
    return {
      statuses: statuses.map((s) => ({
        _id: s._id.toString(),
        name: s.name,
        slug: s.slug,
        color: s.color,
        order: s.order,
        isCompleted: s.isCompleted,
        tasks: statusTasksMap.get(s._id.toString()) ?? [],
      })),
    };
  }

  async getTaskList(
    groupId: string,
    query: ListTaskQueryDto,
  ): Promise<TaskListResult> {
    const board = await this.getKanbanTasks(groupId, query);

    return {
      tasks: board.statuses.flatMap((status) =>
        status.tasks.map((task) => ({
          ...task,
          statusId: status._id,
          statusName: status.name,
          statusColor: status.color,
          statusIsCompleted: status.isCompleted,
        })),
      ),
    };
  }

  async getMyTasks(
    requesterId: string,
    query: ListMyTaskQueryDto,
  ): Promise<MyTaskListResult> {
    if (!isValidObjectId(requesterId)) {
      return {
        groups: [],
        filterOptions: { groups: [], statuses: [], labels: [] },
        totals: { taskCount: 0, groupCount: 0 },
      };
    }

    const requesterObjectId = toObjectId(requesterId);
    const memberships = await this.groupMemberModel
      .find({ userId: requesterObjectId })
      .select({ groupId: 1, role: 1 })
      .lean()
      .exec();

    if (memberships.length === 0) {
      return {
        groups: [],
        filterOptions: { groups: [], statuses: [], labels: [] },
        totals: { taskCount: 0, groupCount: 0 },
      };
    }

    const membershipRoleMap = new Map(
      memberships.map((membership) => [
        membership.groupId.toString(),
        membership.role,
      ]),
    );
    const membershipGroupIds = memberships.map(
      (membership) => membership.groupId,
    );
    const membershipGroupIdSet = new Set(
      memberships.map((membership) => membership.groupId.toString()),
    );

    const candidateTasks = await this.taskModel
      .find({
        assigneeId: requesterObjectId,
        groupId: { $in: membershipGroupIds },
      })
      .select({
        title: 1,
        groupId: 1,
        statusId: 1,
        deadline: 1,
        createdAt: 1,
        updatedAt: 1,
      })
      .lean()
      .exec();

    if (candidateTasks.length === 0) {
      return {
        groups: [],
        filterOptions: { groups: [], statuses: [], labels: [] },
        totals: { taskCount: 0, groupCount: 0 },
      };
    }

    const candidateTaskIds = candidateTasks.map((task) => task._id);
    const candidateGroupIds = Array.from(
      new Set(candidateTasks.map((task) => task.groupId.toString())),
    ).map((id) => toObjectId(id));
    const candidateStatusIds = Array.from(
      new Set(candidateTasks.map((task) => task.statusId.toString())),
    ).map((id) => toObjectId(id));

    const [taskLabelDocs, groups, statuses, memberCounts] = await Promise.all([
      this.taskLabelModel
        .find({ taskId: { $in: candidateTaskIds } })
        .select({ taskId: 1, labelId: 1 })
        .lean()
        .exec(),
      this.groupModel
        .find({ _id: { $in: candidateGroupIds } })
        .select({ name: 1 })
        .lean()
        .exec(),
      this.statusModel
        .find({ _id: { $in: candidateStatusIds } })
        .select({ groupId: 1, name: 1, color: 1, order: 1, isCompleted: 1 })
        .lean()
        .exec(),
      this.groupMemberModel
        .aggregate<{
          _id: Types.ObjectId;
          memberIds: Types.ObjectId[];
        }>([
          { $match: { groupId: { $in: candidateGroupIds } } },
          { $group: { _id: '$groupId', memberIds: { $addToSet: '$userId' } } },
        ])
        .exec(),
    ]);

    const labelIds = Array.from(
      new Set(taskLabelDocs.map((taskLabel) => taskLabel.labelId.toString())),
    ).map((id) => toObjectId(id));
    const labels =
      labelIds.length > 0
        ? await this.labelModel
            .find({ _id: { $in: labelIds } })
            .select({ groupId: 1, name: 1, color: 1 })
            .lean()
            .exec()
        : [];

    const groupMap = new Map(
      groups.map((group) => [group._id.toString(), group]),
    );
    const statusMap = new Map(
      statuses.map((status) => [status._id.toString(), status]),
    );
    const labelMap = new Map(
      labels.map((label) => [label._id.toString(), label]),
    );
    const memberCountMap = new Map(
      memberCounts.map((entry) => [
        entry._id.toString(),
        entry.memberIds.length,
      ]),
    );
    const taskLabelIdsMap = new Map<string, string[]>();
    const taskLabelsMap = new Map<string, LabelRef[]>();

    for (const taskLabel of taskLabelDocs) {
      const taskKey = taskLabel.taskId.toString();
      const labelKey = taskLabel.labelId.toString();
      const label = labelMap.get(labelKey);

      if (!taskLabelIdsMap.has(taskKey)) {
        taskLabelIdsMap.set(taskKey, []);
      }
      taskLabelIdsMap.get(taskKey)!.push(labelKey);

      if (!label) {
        continue;
      }

      if (!taskLabelsMap.has(taskKey)) {
        taskLabelsMap.set(taskKey, []);
      }

      taskLabelsMap.get(taskKey)!.push({
        _id: label._id.toString(),
        name: label.name,
        color: label.color,
      });
    }

    const filterOptions = {
      groups: groups
        .filter((group) => membershipGroupIdSet.has(group._id.toString()))
        .map((group) => ({
          groupId: group._id.toString(),
          name: group.name,
          role: membershipRoleMap.get(group._id.toString()) ?? GroupRole.MEMBER,
          memberCount: memberCountMap.get(group._id.toString()) ?? 0,
        }))
        .sort((left, right) => left.name.localeCompare(right.name)),
      statuses: statuses
        .map((status) => ({
          groupId: status.groupId.toString(),
          groupName: groupMap.get(status.groupId.toString())?.name ?? '',
          statusId: status._id.toString(),
          name: status.name,
          color: status.color,
          isCompleted: status.isCompleted,
          order: status.order,
        }))
        .sort(
          (left, right) =>
            left.groupName.localeCompare(right.groupName) ||
            Number(left.isCompleted) - Number(right.isCompleted) ||
            left.order - right.order,
        )
        .map((item) => {
          const { order, ...rest } = item;
          void order;
          return rest;
        }),
      labels: labels
        .map((label) => ({
          groupId: label.groupId.toString(),
          groupName: groupMap.get(label.groupId.toString())?.name ?? '',
          labelId: label._id.toString(),
          name: label.name,
          color: label.color,
        }))
        .sort(
          (left, right) =>
            left.groupName.localeCompare(right.groupName) ||
            left.name.localeCompare(right.name),
        ),
    };

    const searchRegex = query.q
      ? new RegExp(query.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
      : null;
    const allowedGroupIdSet =
      query.groupIds && query.groupIds.length > 0
        ? new Set(
            query.groupIds.filter((groupId) =>
              membershipGroupIdSet.has(groupId),
            ),
          )
        : null;
    const allowedStatusIdSet =
      query.statusIds && query.statusIds.length > 0
        ? new Set(query.statusIds)
        : null;
    const allowedLabelIdSet =
      query.labelIds && query.labelIds.length > 0
        ? new Set(query.labelIds)
        : null;
    const dateFrom = query.dateFrom ? new Date(query.dateFrom) : null;
    const dateTo = query.dateTo ? new Date(query.dateTo) : null;
    const now = new Date();

    const filteredTasks = candidateTasks.filter((task) => {
      const groupId = task.groupId.toString();
      const statusId = task.statusId.toString();
      const taskLabels = taskLabelIdsMap.get(task._id.toString()) ?? [];

      if (allowedGroupIdSet && !allowedGroupIdSet.has(groupId)) {
        return false;
      }

      if (allowedStatusIdSet && !allowedStatusIdSet.has(statusId)) {
        return false;
      }

      if (
        allowedLabelIdSet &&
        !taskLabels.some((labelId) => allowedLabelIdSet.has(labelId))
      ) {
        return false;
      }

      if (searchRegex && !searchRegex.test(task.title)) {
        return false;
      }

      if ((dateFrom || dateTo) && !task.deadline) {
        return false;
      }

      if (dateFrom && task.deadline && task.deadline < dateFrom) {
        return false;
      }

      if (dateTo && task.deadline && task.deadline > dateTo) {
        return false;
      }

      return true;
    });

    const groupedTasks = new Map<
      string,
      Array<{
        taskId: string;
        groupId: string;
        title: string;
        deadline: Date | null;
        createdAt: Date;
        updatedAt: Date;
        status: {
          statusId: string;
          name: string;
          color: string;
          isCompleted: boolean;
        };
        labels: LabelRef[];
      }>
    >();

    for (const task of filteredTasks) {
      const groupId = task.groupId.toString();
      const status = statusMap.get(task.statusId.toString());
      const taskWithTimestamps = task as typeof task & {
        createdAt: Date;
        updatedAt: Date;
      };

      if (!status) {
        continue;
      }

      if (!groupedTasks.has(groupId)) {
        groupedTasks.set(groupId, []);
      }

      groupedTasks.get(groupId)!.push({
        taskId: task._id.toString(),
        groupId,
        title: task.title,
        deadline: task.deadline,
        createdAt: taskWithTimestamps.createdAt,
        updatedAt: taskWithTimestamps.updatedAt,
        status: {
          statusId: status._id.toString(),
          name: status.name,
          color: status.color,
          isCompleted: status.isCompleted,
        },
        labels: taskLabelsMap.get(task._id.toString()) ?? [],
      });
    }

    const getTaskPriority = (task: {
      deadline: Date | null;
      status: { isCompleted: boolean };
      createdAt: Date;
    }) => {
      const isOverdue =
        Boolean(task.deadline) &&
        !task.status.isCompleted &&
        task.deadline!.getTime() < now.getTime();
      return {
        isOverdue,
        deadlineTime: task.deadline?.getTime() ?? Number.MAX_SAFE_INTEGER,
        createdAtTime: task.createdAt.getTime(),
      };
    };

    const groupSections = Array.from(groupedTasks.entries())
      .map(([groupId, tasks]) => {
        const sortedTasks = tasks.slice().sort((left, right) => {
          const leftPriority = getTaskPriority(left);
          const rightPriority = getTaskPriority(right);

          return (
            Number(rightPriority.isOverdue) - Number(leftPriority.isOverdue) ||
            leftPriority.deadlineTime - rightPriority.deadlineTime ||
            rightPriority.createdAtTime - leftPriority.createdAtTime
          );
        });

        const group = groupMap.get(groupId);
        if (!group) {
          return null;
        }

        return {
          group: {
            groupId,
            name: group.name,
            role: membershipRoleMap.get(groupId) ?? GroupRole.MEMBER,
            memberCount: memberCountMap.get(groupId) ?? 0,
          },
          tasks: sortedTasks,
          total: sortedTasks.length,
        };
      })
      .filter((section): section is NonNullable<typeof section> =>
        Boolean(section),
      )
      .sort((left, right) => {
        const leftTop = left.tasks[0];
        const rightTop = right.tasks[0];
        if (!leftTop || !rightTop) {
          return left.group.name.localeCompare(right.group.name);
        }

        const leftPriority = getTaskPriority(leftTop);
        const rightPriority = getTaskPriority(rightTop);

        return (
          Number(rightPriority.isOverdue) - Number(leftPriority.isOverdue) ||
          leftPriority.deadlineTime - rightPriority.deadlineTime ||
          left.group.name.localeCompare(right.group.name)
        );
      });

    return {
      groups: groupSections,
      filterOptions,
      totals: {
        taskCount: filteredTasks.length,
        groupCount: groupSections.length,
      },
    };
  }

  // ---------------------------------------------------------------------------
  // PATCH /groups/:groupId/tasks/:taskId — Cập nhật task
  // ---------------------------------------------------------------------------

  /**
   * Cập nhật một task (partial update).
   *
   * Luồng xử lý:
   * 1. Tìm task, đảm bảo thuộc đúng groupId (chặn cross-group access)
   * 2. Validate song song các fields được truyền (statusId, assigneeId, deadline, labelIds)
   * 3. Xây dựng $set object — chỉ gồm các fields thực sự thay đổi
   * 4. Reset notification flags nếu task chuyển từ completed → non-completed
   * 5. Persist: dùng transaction nếu labelIds thay đổi (task + task_labels phải nhất quán)
   *    Không dùng transaction nếu chỉ update task fields (ít overhead hơn)
   * 6. Trả về task đã populate đầy đủ — tái dụng getTaskDetail
   */
  async updateTask(
    groupId: string,
    taskId: string,
    dto: UpdateTaskDto,
  ): Promise<TaskDetailResult> {
    if (!isValidObjectId(groupId) || !isValidObjectId(taskId)) {
      throw new NotFoundException(TASK_ERRORS.NOT_FOUND);
    }

    const groupObjectId = toObjectId(groupId);
    const taskObjectId = toObjectId(taskId);

    // Bước 1: Load task hiện tại — đảm bảo thuộc đúng group, tránh cross-group access
    const existingTask = await this.taskModel
      .findOne({ _id: taskObjectId, groupId: groupObjectId })
      .lean()
      .exec();

    if (!existingTask) {
      throw new NotFoundException(TASK_ERRORS.NOT_FOUND);
    }

    // Bước 2: Validate từng field được truyền (chạy song song nếu độc lập)

    // — Luôn cần biết oldStatus.isCompleted khi: (a) statusId thay đổi, hoặc
    //   (b) deadline / assignee thay đổi (để biết có cần reset notification flags không).
    //   Tải trước một lần để tránh load lại nhiều chỗ.
    const needOldStatus =
      dto.statusId !== undefined ||
      dto.deadline !== undefined ||
      dto.assigneeId !== undefined;
    let oldStatusIsCompleted = false;
    if (needOldStatus) {
      const oldStatus = await this.statusModel
        .findById(existingTask.statusId)
        .select({ isCompleted: 1 })
        .lean()
        .exec();
      oldStatusIsCompleted = oldStatus?.isCompleted ?? false;
    }

    // — statusId: validate thuộc cùng group
    let newStatus: StatusDocument | null = null;
    if (dto.statusId !== undefined) {
      newStatus = await this._resolveStatus(groupObjectId, dto.statusId);
    }

    // — assigneeId: validate là member nếu non-null; null = bỏ giao việc
    let assigneeUser: {
      _id: Types.ObjectId;
      name: string;
      avatar: string | null;
    } | null = null;
    const assigneeChanging = dto.assigneeId !== undefined;
    if (assigneeChanging && dto.assigneeId !== null) {
      assigneeUser = await this._validateAssignee(
        groupObjectId,
        dto.assigneeId!,
      );
    }

    // — deadline: validate > now nếu non-null; null = xóa deadline
    let deadlineValue: Date | null | undefined = undefined;
    let deadlineChanging = false;
    if (dto.deadline !== undefined) {
      deadlineChanging = true;
      if (dto.deadline !== null) {
        const parsed = new Date(dto.deadline);
        if (parsed <= new Date()) {
          throw new BadRequestException(TASK_ERRORS.DEADLINE_IN_PAST);
        }
        deadlineValue = parsed;
      } else {
        deadlineValue = null;
      }
    }

    // — labelIds: validate tất cả thuộc cùng group
    let resolvedLabels: Array<{
      _id: Types.ObjectId;
      name: string;
      color: string;
    }> | null = null;
    const labelsChanging = dto.labelIds !== undefined;
    if (labelsChanging) {
      resolvedLabels = await this._resolveLabels(
        groupObjectId,
        this._dedupeIds(dto.labelIds ?? []),
      );
    }

    // Bước 3: Xây dựng $set — chỉ gồm fields có trong dto
    const $set: Record<string, unknown> = {};
    if (dto.title !== undefined) {
      $set.title = this._normalizeTaskTitle(dto.title);
    }
    if (dto.description !== undefined) {
      $set.description = this._normalizeTaskDescription(dto.description);
    }

    if (dto.statusId !== undefined && newStatus) {
      $set.statusId = newStatus._id;

      // Reset notification flags khi task được "mở lại" từ completed → non-completed.
      // Ví dụ: chuyển "Done" → "Todo": cần gửi lại reminder/overdue nếu deadline còn hiệu lực.
      // Không reset khi chuyển giữa 2 non-completed statuses (ví dụ: "Todo" → "Doing").
      if (oldStatusIsCompleted && !newStatus.isCompleted) {
        $set.reminderSentAt = null;
        $set.overdueSentAt = null;
      }
    }

    if (assigneeChanging) {
      $set.assigneeId = assigneeUser ? assigneeUser._id : null;
    }
    if (deadlineValue !== undefined) {
      $set.deadline = deadlineValue;
    }

    // Reset notification flags khi deadline hoặc assignee thay đổi trên task chưa hoàn thành.
    // Lý do:
    //   - deadline đổi: reminder/overdue cũ không còn phù hợp.
    //   - assignee đổi: người nhận email đã thay đổi, cần cho phép gửi lại cho người mới.
    // Không reset nếu task đã hoàn thành (cron bỏ qua completed tasks).
    if ((deadlineChanging || assigneeChanging) && !oldStatusIsCompleted) {
      $set.reminderSentAt = null;
      $set.overdueSentAt = null;
    }

    const hasFieldUpdates = Object.keys($set).length > 0;

    // Bước 4: Persist — dùng transaction khi cần đồng bộ labels
    if (hasFieldUpdates || labelsChanging) {
      if (labelsChanging) {
        // Transaction đảm bảo task + task_labels thay đổi nguyên tử.
        // Nếu insertMany thất bại, task update cũng bị rollback — không ra trạng thái dở.
        try {
          await this._runWithOptionalTransaction(async (session) => {
            if (hasFieldUpdates) {
              await this.taskModel.updateOne(
                { _id: taskObjectId, groupId: groupObjectId },
                { $set },
                session ? { session } : undefined,
              );
            }

            // Đồng bộ labels: xóa toàn bộ cũ → insert mới.
            // Delete-then-insert đơn giản và chính xác hơn upsert từng record,
            // tránh orphan records khi client bỏ một label ra khỏi danh sách.
            await this.taskLabelModel.deleteMany(
              { taskId: taskObjectId },
              session ? { session } : undefined,
            );
            if (resolvedLabels!.length > 0) {
              const taskLabels = resolvedLabels!.map((l) => ({
                taskId: taskObjectId,
                labelId: l._id,
              }));

              if (session) {
                await this.taskLabelModel.insertMany(taskLabels, { session });
              } else {
                await this.taskLabelModel.insertMany(taskLabels);
              }
            }
          });
        } catch (error) {
          this.logger.error(`Cập nhật task ${taskId} thất bại`, error);
          throw new InternalServerErrorException(
            'Cập nhật task thất bại, vui lòng thử lại',
          );
        }
      } else {
        // Không có label change → update đơn giản, không cần transaction
        await this.taskModel.updateOne(
          { _id: taskObjectId, groupId: groupObjectId },
          { $set },
        );
      }

      this.logger.log(
        `Task ${taskId} cập nhật thành công trong nhóm ${groupId}`,
      );
    }

    // Bước 5: Trả về task đã populate đầy đủ — tái dụng getTaskDetail
    return this.getTaskDetail(groupId, taskId);
  }

  // ---------------------------------------------------------------------------
  // DELETE /groups/:groupId/tasks/:taskId — Xóa task
  // ---------------------------------------------------------------------------

  /**
   * Xóa task và toàn bộ task_labels liên quan.
   *
   * Luồng xử lý:
   * 1. Validate taskId format + load task (scoped theo groupId)
   * 2. Kiểm tra quyền: chỉ owner/admin của group được xóa
   *    - Kiểm tra role qua groupMemberModel
   * 3. Transaction: xóa task_labels → xóa task (cascade nguyên tử)
   *    Order: xóa join-table trước để tránh orphaned records nếu task delete thành công
   *    nhưng task_labels delete thất bại sau khi rollback
   */
  async deleteTask(
    groupId: string,
    taskId: string,
    requesterId: string,
  ): Promise<void> {
    if (!isValidObjectId(groupId) || !isValidObjectId(taskId)) {
      throw new NotFoundException(TASK_ERRORS.NOT_FOUND);
    }

    const groupObjectId = toObjectId(groupId);
    const taskObjectId = toObjectId(taskId);
    const requesterObjectId = toObjectId(requesterId);

    // Bước 1: Load task — scoped theo groupId để ngăn cross-group access
    const task = await this.taskModel
      .findOne({ _id: taskObjectId, groupId: groupObjectId })
      .select({ creatorId: 1 })
      .lean()
      .exec();

    if (!task) {
      throw new NotFoundException(TASK_ERRORS.NOT_FOUND);
    }

    // Bước 2: Kiểm tra quyền xóa — chỉ owner/admin của group
    const membership = await this.groupMemberModel
      .findOne({ groupId: groupObjectId, userId: requesterObjectId })
      .select({ role: 1 })
      .lean()
      .exec();

    const isManager =
      membership?.role === GroupRole.OWNER ||
      membership?.role === GroupRole.ADMIN;
    if (!isManager) {
      throw new ForbiddenException(TASK_ERRORS.FORBIDDEN_DELETE);
    }

    // Bước 3: Transaction — xóa task_labels trước, sau đó xóa task
    // Cascade nguyên tử: không để lại orphaned task_labels nếu một trong hai thất bại
    try {
      await this._runWithOptionalTransaction(async (session) => {
        // Xóa join-table trước để tránh foreign-key inconsistency
        await this.taskLabelModel.deleteMany(
          { taskId: taskObjectId },
          session ? { session } : undefined,
        );
        await this.taskCommentModel.deleteMany(
          { taskId: taskObjectId },
          session ? { session } : undefined,
        );
        await this.taskAttachmentModel.deleteMany(
          { taskId: taskObjectId },
          session ? { session } : undefined,
        );
        await this.taskModel.deleteOne(
          { _id: taskObjectId },
          session ? { session } : undefined,
        );
      });

      await this.taskFileStorageService.deleteTaskDirectory(groupId, taskId);
      this.logger.log(
        `Task ${taskId} đã xóa thành công khỏi nhóm ${groupId} bởi user ${requesterId}`,
      );
    } catch (error) {
      this.logger.error(`Xóa task ${taskId} thất bại`, error);
      throw new InternalServerErrorException(
        'Xóa task thất bại, vui lòng thử lại',
      );
    }
  }

  // ---------------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------------

  private _buildTaskObjectIds(groupId: string, taskId: string) {
    if (!isValidObjectId(groupId) || !isValidObjectId(taskId)) {
      throw new NotFoundException(TASK_ERRORS.NOT_FOUND);
    }

    return {
      groupObjectId: toObjectId(groupId),
      taskObjectId: toObjectId(taskId),
    };
  }

  private async _ensureTaskExists(
    groupObjectId: Types.ObjectId,
    taskObjectId: Types.ObjectId,
  ): Promise<void> {
    const exists = await this.taskModel
      .exists({ _id: taskObjectId, groupId: groupObjectId })
      .exec();

    if (!exists) {
      throw new NotFoundException(TASK_ERRORS.NOT_FOUND);
    }
  }

  private _startSession(): Promise<ClientSession> {
    return this.taskModel.db.startSession();
  }

  private async _runWithOptionalTransaction<T>(
    operation: (session?: ClientSession) => Promise<T>,
  ): Promise<T> {
    const session = await this._startSession();

    try {
      return await this._runWithExistingSessionFallback(session, operation);
    } finally {
      await session.endSession();
    }
  }

  private async _runWithExistingSessionFallback<T>(
    session: ClientSession,
    operation: (session?: ClientSession) => Promise<T>,
  ): Promise<T> {
    try {
      let result!: T;
      await session.withTransaction(async () => {
        result = await operation(session);
      });
      return result;
    } catch (error) {
      if (!this._isTransactionUnsupportedError(error)) {
        throw error;
      }

      this.logger.warn(
        'MongoDB khong ho tro transaction, fallback sang non-transaction mode cho task',
      );

      return operation();
    }
  }

  private _isTransactionUnsupportedError(error: unknown): boolean {
    if (!(error instanceof Error)) {
      return false;
    }

    return (
      error.message.includes(
        'Transaction numbers are only allowed on a replica set member or mongos',
      ) ||
      error.message.includes('Transaction support is unavailable') ||
      error.message.includes('transactions are not supported')
    );
  }

  private _normalizeTaskTitle(input: string): string {
    const normalized = typeof input === 'string' ? input.trim() : '';
    if (!normalized) {
      throw new BadRequestException(TASK_ERRORS.TITLE_REQUIRED);
    }
    if (normalized.length > 200) {
      throw new BadRequestException(TASK_ERRORS.TITLE_TOO_LONG);
    }
    return normalized;
  }

  private _normalizeTaskDescription(
    input: string | null | undefined,
  ): string | null {
    try {
      return sanitizeTaskDescriptionHtml(input);
    } catch (error) {
      if (error instanceof Error) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
  }

  private _normalizeTaskComment(input: string | null | undefined): string {
    try {
      return normalizeTaskCommentContent(input);
    } catch (error) {
      if (error instanceof Error) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
  }

  private _dedupeIds(ids: string[]): string[] {
    return Array.from(new Set(ids.filter(Boolean)));
  }

  private async _getMembershipRole(
    groupObjectId: Types.ObjectId,
    userObjectId: Types.ObjectId,
  ): Promise<GroupRole | null> {
    const membership = await this.groupMemberModel
      .findOne({ groupId: groupObjectId, userId: userObjectId })
      .select({ role: 1 })
      .lean()
      .exec();

    return membership?.role ?? null;
  }

  private _isManagerRole(role: GroupRole | null | undefined): boolean {
    return role === GroupRole.OWNER || role === GroupRole.ADMIN;
  }

  private _normalizeFileName(fileName: string): string {
    const normalized = path.basename(fileName).trim();
    if (!normalized) {
      throw new BadRequestException(TASK_ERRORS.ATTACHMENT_EMPTY);
    }
    if (normalized.length > 255) {
      throw new BadRequestException(TASK_ERRORS.ATTACHMENT_NAME_TOO_LONG);
    }
    return normalized;
  }

  private _validateAttachmentFile(file: UploadedTaskFile): void {
    if (
      !file ||
      !file.originalname ||
      file.size <= 0 ||
      file.buffer.length === 0
    ) {
      throw new BadRequestException(TASK_ERRORS.ATTACHMENT_EMPTY);
    }

    if (file.size > TASK_ATTACHMENT_MAX_SIZE) {
      throw new BadRequestException(TASK_ERRORS.ATTACHMENT_TOO_LARGE);
    }

    const ext = path.extname(file.originalname).toLowerCase();
    if (
      !TASK_ATTACHMENT_ALLOWED_EXTENSIONS.has(ext) ||
      !TASK_ATTACHMENT_ALLOWED_MIME_TYPES.has(file.mimetype)
    ) {
      throw new BadRequestException(TASK_ERRORS.ATTACHMENT_UNSUPPORTED);
    }

    this._normalizeFileName(file.originalname);
  }

  private async _mapAttachments(
    attachments: Array<
      | (TaskAttachmentDocument & { createdAt?: Date })
      | (TaskAttachment & {
          _id: Types.ObjectId;
          createdAt?: Date;
          uploadedBy: Types.ObjectId;
        })
      | Record<string, unknown>
    >,
  ): Promise<TaskAttachmentResult[]> {
    if (attachments.length === 0) {
      return [];
    }

    const uploaderIds = Array.from(
      new Set(
        attachments
          .map((item) =>
            String(
              (item as { uploadedBy: Types.ObjectId | string }).uploadedBy,
            ),
          )
          .filter(Boolean),
      ),
    ).map((id) => toObjectId(id));

    const uploaders =
      uploaderIds.length > 0
        ? await this.userModel
            .find({ _id: { $in: uploaderIds } })
            .select({ name: 1, avatar: 1 })
            .lean()
            .exec()
        : [];

    const uploaderMap = new Map(
      uploaders.map((user) => [user._id.toString(), user]),
    );

    return attachments.map((attachment) => {
      const typed = attachment as {
        _id: Types.ObjectId;
        originalName: string;
        storedName: string;
        mimeType: string;
        size: number;
        uploadedBy: Types.ObjectId;
        createdAt?: Date;
      };
      const uploader = uploaderMap.get(typed.uploadedBy.toString());
      return {
        _id: typed._id.toString(),
        originalName: typed.originalName,
        storedName: typed.storedName,
        mimeType: typed.mimeType,
        size: typed.size,
        uploadedBy: {
          _id: typed.uploadedBy.toString(),
          name: uploader?.name ?? '',
          avatar: uploader?.avatar ?? null,
        },
        createdAt: typed.createdAt ?? new Date(),
      };
    });
  }

  private async _mapComments(
    comments: Array<
      | (TaskCommentDocument & { createdAt?: Date; updatedAt?: Date })
      | (TaskComment & {
          _id: Types.ObjectId;
          createdAt?: Date;
          updatedAt?: Date;
          authorId: Types.ObjectId;
        })
      | Record<string, unknown>
    >,
  ): Promise<TaskCommentResult[]> {
    if (comments.length === 0) {
      return [];
    }

    const authorIds = Array.from(
      new Set(
        comments
          .map((item) =>
            String((item as { authorId: Types.ObjectId | string }).authorId),
          )
          .filter(Boolean),
      ),
    ).map((id) => toObjectId(id));

    const authors =
      authorIds.length > 0
        ? await this.userModel
            .find({ _id: { $in: authorIds } })
            .select({ name: 1, avatar: 1 })
            .lean()
            .exec()
        : [];

    const authorMap = new Map(
      authors.map((user) => [user._id.toString(), user]),
    );

    return comments.map((comment) => {
      const typed = comment as {
        _id: Types.ObjectId;
        content: string;
        authorId: Types.ObjectId;
        createdAt?: Date;
        updatedAt?: Date;
      };
      const author = authorMap.get(typed.authorId.toString());
      const createdAt = typed.createdAt ?? new Date();
      const updatedAt = typed.updatedAt ?? createdAt;

      return {
        _id: typed._id.toString(),
        content: typed.content,
        author: {
          _id: typed.authorId.toString(),
          name: author?.name ?? '',
          avatar: author?.avatar ?? null,
        },
        createdAt,
        updatedAt,
        isEdited: updatedAt.getTime() !== createdAt.getTime(),
      };
    });
  }

  /**
   * Resolve statusId về document Status.
   * - Nếu statusId không truyền → tìm status có isDefault = true của group.
   * - Nếu statusId được truyền → tìm và validate thuộc cùng group.
   */
  private async _resolveStatus(
    groupObjectId: Types.ObjectId,
    statusId?: string,
  ): Promise<StatusDocument> {
    if (!statusId) {
      // Không truyền statusId → dùng default status của group
      const defaultStatus = await this.statusModel
        .findOne({ groupId: groupObjectId, isDefault: true })
        .exec();

      if (!defaultStatus) {
        throw new BadRequestException(TASK_ERRORS.DEFAULT_STATUS_NOT_FOUND);
      }
      return defaultStatus;
    }

    // statusId được truyền → validate format và xác nhận thuộc đúng group
    if (!isValidObjectId(statusId)) {
      throw new BadRequestException(TASK_ERRORS.STATUS_NOT_IN_GROUP);
    }

    const status = await this.statusModel
      .findOne({ _id: toObjectId(statusId), groupId: groupObjectId })
      .exec();

    if (!status) {
      throw new BadRequestException(TASK_ERRORS.STATUS_NOT_IN_GROUP);
    }
    return status;
  }

  /**
   * Validate assigneeId là member của group và trả về thông tin user.
   * Chạy query GroupMember (validation) và User (populate) song song.
   */
  private async _validateAssignee(
    groupObjectId: Types.ObjectId,
    assigneeId: string,
  ): Promise<{ _id: Types.ObjectId; name: string; avatar: string | null }> {
    if (!isValidObjectId(assigneeId)) {
      throw new BadRequestException(TASK_ERRORS.ASSIGNEE_NOT_MEMBER);
    }

    const assigneeObjectId = toObjectId(assigneeId);

    // Chạy song song: kiểm tra membership + lấy thông tin user
    const [isMember, user] = await Promise.all([
      this.groupMemberModel
        .exists({ groupId: groupObjectId, userId: assigneeObjectId })
        .exec(),
      this.userModel
        .findById(assigneeObjectId)
        .select({ name: 1, avatar: 1 })
        .lean()
        .exec(),
    ]);

    if (!isMember) {
      throw new BadRequestException(TASK_ERRORS.ASSIGNEE_NOT_MEMBER);
    }

    return {
      _id: assigneeObjectId,
      name: user?.name ?? '',
      avatar: user?.avatar ?? null,
    };
  }

  /**
   * Validate và load labels — tất cả labelIds phải thuộc cùng group.
   * Nếu một labelId không tồn tại trong group → reject toàn bộ request.
   */
  private async _resolveLabels(
    groupObjectId: Types.ObjectId,
    labelIds: string[],
  ): Promise<Array<{ _id: Types.ObjectId; name: string; color: string }>> {
    if (labelIds.length === 0) return [];

    // Validate format trước khi query
    if (labelIds.some((id) => !isValidObjectId(id))) {
      throw new BadRequestException(TASK_ERRORS.LABEL_NOT_IN_GROUP);
    }

    const objectIds = labelIds.map((id) => toObjectId(id));

    // Query một lần: lấy tất cả labels trong group khớp với labelIds
    const found = await this.labelModel
      .find({ _id: { $in: objectIds }, groupId: groupObjectId })
      .select({ name: 1, color: 1 })
      .lean()
      .exec();

    // Tất cả labelIds phải tồn tại trong group — reject nếu thiếu
    if (found.length !== labelIds.length) {
      throw new BadRequestException(TASK_ERRORS.LABEL_NOT_IN_GROUP);
    }

    return found.map((l) => ({
      _id: l._id,
      name: l.name,
      color: l.color,
    }));
  }
}
