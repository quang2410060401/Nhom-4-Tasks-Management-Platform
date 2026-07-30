import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Task, TaskDocument } from './schemas/task.schema';
import { Status, StatusDocument } from '../group/schemas/status.schema';
import { User, UserDocument } from '../auth/schemas/user.schema';
import { MailService } from '../../common/mail/mail.service';
import {
  TASK_OVERDUE_CRON_EXPRESSION,
  TASK_REMINDER_CRON_EXPRESSION,
  TASK_REMINDER_RESEND_COOLDOWN_MINUTES,
  TASK_REMINDER_WINDOW_MINUTES,
} from './task.constants';
import { toObjectId } from '../../common/utils/object-id.util';

/**
 * TaskNotificationService — Cron job gửi email nhắc nhở và quá hạn cho tasks.
 *
 * Hai job hoạt động độc lập:
 *   - reminderJob: mỗi 15 phút — nhắc trước deadline ≤ 60 phút
 *   - overdueJob:  mỗi 15 phút — thông báo task đã quá hạn
 *
 * Chống spam lặp lại:
 *   - reminder: nếu reminderSentAt còn nằm trong 60 phút gần nhất thì KHÔNG gửi lại.
 *   - overdueSentAt là sent-flag. Query overdue chỉ lấy tasks có flag = null.
 *   - Sau khi gửi thành công → set flag ngay lập tức (updateOne).
 *   - Nếu SMTP thất bại → flag KHÔNG được set → cron tiếp theo sẽ thử lại.
 *   - Không dùng distributed lock — chấp nhận ít rủi ro trùng trên multi-instance
 *     vì flag được set ngay sau mỗi task (window nhỏ).
 */
@Injectable()
export class TaskNotificationService {
  private readonly logger = new Logger(TaskNotificationService.name);

  constructor(
    @InjectModel(Task.name) private readonly taskModel: Model<TaskDocument>,
    @InjectModel(Status.name)
    private readonly statusModel: Model<StatusDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    private readonly mailService: MailService,
    private readonly configService: ConfigService,
  ) {}

  private isInternalCronEnabled(): boolean {
    return this.configService.get<string>('ENABLE_INTERNAL_CRON') !== 'false';
  }

  // ---------------------------------------------------------------------------
  // Cron 1: Nhắc trước deadline
  // ---------------------------------------------------------------------------

  /**
   * Chạy mỗi 15 phút. Tìm tasks sắp đến hạn trong 60 phút tới chưa được nhắc
   * trong vòng 60 phút gần nhất.
   *
   * Điều kiện chọn task:
   *   - deadline > now  (chưa quá hạn)
   *   - deadline <= now + 60 phút  (trong cửa sổ nhắc nhở)
   *   - reminderSentAt = null hoặc < now - 60 phút
   *   - status.isCompleted = false  (chưa hoàn thành)
   *
  * Sau khi gửi email thành công → set reminderSentAt = now.
  * Nếu SMTP lỗi → log và tiếp tục task kế tiếp, không bỏ flag → cron sau thử lại.
  */
  @Cron(TASK_REMINDER_CRON_EXPRESSION)
  async handleReminderCron(): Promise<void> {
    if (!this.isInternalCronEnabled()) {
      return;
    }

    await this.sendReminderNotifications();
  }

  async sendReminderNotifications(): Promise<void> {
    const now = new Date();
    const windowEnd = new Date(
      now.getTime() + TASK_REMINDER_WINDOW_MINUTES * 60 * 1000,
    );
    const resendCooldownStart = new Date(
      now.getTime() - TASK_REMINDER_RESEND_COOLDOWN_MINUTES * 60 * 1000,
    );

    // ── Bước 1: Tìm tất cả statusIds có isCompleted = false trong hệ thống ────
    // Dùng distinct để lấy mảng gọn, tránh join trong aggregation
    const incompleteStatusIds = await this.statusModel
      .distinct('_id', { isCompleted: false })
      .exec();

    if (incompleteStatusIds.length === 0) {
      return; // Không có status nào chưa hoàn thành — bỏ qua
    }

    // ── Bước 2: Lấy tasks đủ điều kiện nhắc nhở ──────────────────────────────
    // $gt: now loại trừ ngầm deadline = null (null < any Date trong MongoDB)
    // $lte: windowEnd giới hạn cửa sổ 60 phút
    const tasks = await this.taskModel
      .find({
        deadline: { $gt: now, $lte: windowEnd },
        $or: [
          { reminderSentAt: null },
          { reminderSentAt: { $lt: resendCooldownStart } },
        ],
        statusId: { $in: incompleteStatusIds },
      })
      .select({ title: 1, deadline: 1, assigneeId: 1, creatorId: 1 })
      .lean()
      .exec();

    if (tasks.length === 0) {
      this.logger.debug('Reminder cron: không tìm thấy task nào cần nhắc.');
      return;
    }

    this.logger.log(
      `Reminder cron: tìm thấy ${tasks.length} task(s) cần nhắc.`,
    );

    // ── Bước 3: Batch-load user emails trước vòng lặp — tránh N+1 queries ────
    const reminderRecipientIdSet = new Set<string>();
    for (const task of tasks) {
      reminderRecipientIdSet.add(
        (task.assigneeId ?? task.creatorId).toString(),
      );
    }
    const reminderRecipientObjectIds = [...reminderRecipientIdSet].map(
      (id) => toObjectId(id),
    );
    const reminderRecipientDocs = await this.userModel
      .find({ _id: { $in: reminderRecipientObjectIds } })
      .select({ email: 1 })
      .lean()
      .exec();
    const reminderEmailMap = new Map<string, string>(
      reminderRecipientDocs
        .filter((u) => u.email)
        .map((u) => [u._id.toString(), u.email]),
    );

    // ── Bước 4: Xử lý từng task — gửi email rồi set flag ─────────────────────
    for (const task of tasks) {
      const reminderRecipientId = (
        task.assigneeId ?? task.creatorId
      ).toString();
      const email = reminderEmailMap.get(reminderRecipientId);

      if (!email) {
        this.logger.warn(
          `Reminder: không tìm thấy email cho user ${reminderRecipientId} (task ${task._id.toString()})`,
        );
        continue;
      }

      try {
        await this.mailService.sendTaskReminderEmail(
          email,
          task.title,
          task.deadline!,
        );

        // Set flag ngay sau khi gửi thành công — ngăn cron sau gửi lại
        // trong cửa sổ cooldown 60 phút.
        await this.taskModel.updateOne(
          {
            _id: task._id,
            $or: [
              { reminderSentAt: null },
              { reminderSentAt: { $lt: resendCooldownStart } },
            ],
          },
          { $set: { reminderSentAt: new Date() } },
        );

        this.logger.log(
          `Reminder sent: task "${task.title}" (${task._id.toString()}) → ${email}`,
        );
      } catch (error) {
        // Gửi thất bại → KHÔNG set flag → cron tiếp theo sẽ thử lại
        this.logger.error(
          `Reminder thất bại: task ${task._id.toString()} → ${email}`,
          error instanceof Error ? error.stack : String(error),
        );
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Cron 2: Thông báo quá hạn
  // ---------------------------------------------------------------------------

  /**
   * Chạy mỗi 15 phút. Tìm tasks đã quá hạn chưa được thông báo.
   *
   * Điều kiện chọn task:
   *   - deadline < now  (đã qua hạn)
   *   - deadline != null  (tránh quét tasks không có deadline)
   *   - overdueSentAt = null  (chưa gửi overdue notification)
   *   - status.isCompleted = false  (chưa hoàn thành)
   *
  * Sau khi gửi email thành công → set overdueSentAt = now.
  * Nếu SMTP lỗi → log và tiếp tục, không bỏ flag → cron sau thử lại.
  */
  @Cron(TASK_OVERDUE_CRON_EXPRESSION)
  async handleOverdueCron(): Promise<void> {
    if (!this.isInternalCronEnabled()) {
      return;
    }

    await this.sendOverdueNotifications();
  }

  async sendOverdueNotifications(): Promise<void> {
    const now = new Date();

    // ── Bước 1: Tìm tất cả statusIds có isCompleted = false ──────────────────
    const incompleteStatusIds = await this.statusModel
      .distinct('_id', { isCompleted: false })
      .exec();

    if (incompleteStatusIds.length === 0) {
      return;
    }

    // ── Bước 2: Lấy tasks đã quá hạn chưa được thông báo ─────────────────────
    // $ne: null loại trừ tasks chưa có deadline, $lt: now chọn tasks đã qua hạn
    const tasks = await this.taskModel
      .find({
        deadline: { $ne: null, $lt: now },
        overdueSentAt: null,
        statusId: { $in: incompleteStatusIds },
      })
      .select({ title: 1, deadline: 1, assigneeId: 1, creatorId: 1 })
      .lean()
      .exec();

    if (tasks.length === 0) {
      this.logger.debug('Overdue cron: không tìm thấy task nào cần thông báo.');
      return;
    }

    this.logger.log(
      `Overdue cron: tìm thấy ${tasks.length} task(s) đã quá hạn.`,
    );

    // ── Bước 3: Batch-load user emails trước vòng lặp — tránh N+1 queries ────────────
    const overdueRecipientIdSet = new Set<string>();
    for (const task of tasks) {
      overdueRecipientIdSet.add((task.assigneeId ?? task.creatorId).toString());
    }
    const overdueRecipientObjectIds = [...overdueRecipientIdSet].map(
      (id) => toObjectId(id),
    );

    const overdueRecipientDocs = await this.userModel
      .find({ _id: { $in: overdueRecipientObjectIds } })
      .select({ email: 1 })
      .lean()
      .exec();

    const overdueEmailMap = new Map<string, string>(
      overdueRecipientDocs
        .filter((u) => u.email)
        .map((u) => [u._id.toString(), u.email]),
    );

    // ── Bước 4: Xử lý từng task — gửi email rồi set flag ──────────────────────
    for (const task of tasks) {
      const overdueRecipientId = (task.assigneeId ?? task.creatorId).toString();
      const email = overdueEmailMap.get(overdueRecipientId);

      if (!email) {
        this.logger.warn(
          `Overdue: không tìm thấy email cho user ${overdueRecipientId} (task ${task._id.toString()})`,
        );
        continue;
      }

      try {
        await this.mailService.sendTaskOverdueEmail(
          email,
          task.title,
          task.deadline!,
        );

        // Set flag ngay sau khi gửi thành công — condition guard chặn race condition nhẹ
        await this.taskModel.updateOne(
          { _id: task._id, overdueSentAt: null },
          { $set: { overdueSentAt: new Date() } },
        );

        this.logger.log(
          `Overdue sent: task "${task.title}" (${task._id.toString()}) → ${email}`,
        );
      } catch (error) {
        // Gửi thất bại → KHÔNG set flag → cron tiếp theo sẽ thử lại
        this.logger.error(
          `Overdue thất bại: task ${task._id.toString()} → ${email}`,
          error instanceof Error ? error.stack : String(error),
        );
      }
    }
  }
}
