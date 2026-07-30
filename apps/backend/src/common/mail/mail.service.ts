import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

/** Dữ liệu cần thiết để gửi email lời mời tham gia nhóm. */
export interface GroupInviteEmailPayload {
  /** Địa chỉ email của người được mời. */
  toEmail: string;
  /** Tên nhóm hiển thị trong email. */
  groupName: string;
  /** Tên người gửi lời mời hiển thị trong email. */
  inviterName: string;
  /** URL đầy đủ để chấp nhận lời mời, ví dụ: https://app.example.com/invite/accept?token=xxx */
  inviteUrl: string;
}

/** Dữ liệu cần thiết để gửi email xác thực tài khoản. */
export interface VerificationEmailPayload {
  toEmail: string;
  toName: string;
  verifyUrl: string;
}

/**
 * Kết quả kiểm tra kết nối SMTP (dùng nội bộ).
 * TEMPORARY — chỉ dùng cho endpoint test-email trong development.
 */
export interface SmtpVerifyResult {
  ok: boolean;
  /** Thông báo lỗi rõ ràng cho developer, không lộ thông tin nhạy cảm. */
  hint?: string;
}

/**
 * MailService — dịch vụ gửi email dùng chung cho toàn bộ hệ thống.
 *
 * Cấu hình SMTP đọc từ biến môi trường.
 * Có thể mở rộng thêm các phương thức cho invite, reminder, overdue,...
 *
 * ### Lưu ý cấu hình Gmail:
 * - Bật 2FA trên tài khoản Google.
 * - Tạo App Password tại: https://myaccount.google.com/apppasswords
 * - Đặt `SMTP_PASS` = 16 ký tự App Password, KHÔNG có dấu cách.
   *   Ví dụ: `SMTP_PASS=abcdefghijklmnop`  (không phải `abcd efgh ijkl mnop`)
 * - Dùng `SMTP_PORT=587` và `SMTP_SECURE=false` (STARTTLS).
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: Transporter;
  private readonly fromAddress: string;

  constructor(private readonly configService: ConfigService) {
    const host = this.configService.get<string>('SMTP_HOST');
    const port = Number(this.configService.get<string>('SMTP_PORT') ?? 587);
    const secure = this.configService.get<string>('SMTP_SECURE') === 'true';

    // Trim leading/trailing whitespace để tránh env value bị ô nhiễm khoảng trắng.
    // Gmail App Password: strip ALL internal spaces — Google hiển thị dạng "xxxx xxxx xxxx xxxx"
    // nhưng khi dùng programmatically cần bỏ dấu cách: "xxxxxxxxxxxxxxxx".
    const rawUser = this.configService.get<string>('SMTP_USER') ?? '';
    const rawPass = this.configService.get<string>('SMTP_PASS') ?? '';
    const user = this.sanitizeSmtpCredential(rawUser);
    const pass = this.sanitizeSmtpCredential(rawPass);

    const fromName =
      this.configService.get<string>('SMTP_FROM_NAME') ??
      'Tasks Management Platform';
    const fromEmail =
      this.configService.get<string>('SMTP_FROM_EMAIL')?.trim() ?? user ?? '';

    this.fromAddress = `"${fromName}" <${fromEmail}>`;

    // Khởi tạo nodemailer transporter.
    // Port 587: dùng STARTTLS (secure=false + requireTLS=true).
    // Port 465: dùng SSL/TLS trực tiếp (secure=true).
    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      // requireTLS: true đảm bảo kết nối luôn được mã hoá qua STARTTLS (port 587).
      // Bỏ qua nếu đang dùng port 465 (secure=true đã xử lý).
      requireTLS: !secure,
      auth: user && pass ? { user, pass } : undefined,
    });

    this.logger.log(
      `MailService init — host=${host ?? '(none)'} port=${port} secure=${secure} user=${user ? user : '(none)'}`,
    );
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Chuẩn hoá giá trị credential từ env:
   * - Trim leading/trailing whitespace (tránh lỗi copy-paste trong .env).
   * - Xoá internal spaces — Gmail App Password được Google hiển thị với dấu cách
   *   nhưng cần dùng dạng liền nhau khi gửi qua SMTP API.
   */
  private sanitizeSmtpCredential(raw: string): string {
    // Xoá khoảng trắng đầu/cuối, sau đó xoá dấu cách bên trong (App Password normalization)
    return raw.trim().replace(/\s+/g, '');
  }

  /**
   * Escape ký tự HTML đặc biệt trong chuỗi do người dùng cung cấp trước khi nhúng vào email HTML.
   * Ngăn chặn content injection qua tiêu đề task, tên nhóm, v.v.
   */
  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;');
  }

  /**
   * Kiểm tra kết nối + xác thực SMTP bằng `transporter.verify()`.
   *
   * Dùng nội bộ cho endpoint test-email để cung cấp chẩn đoán sớm trước khi gửi thật.
   *
   * @remarks TEMPORARY — chỉ gọi từ `sendTestEmail()`.
   */
  async verifyTransport(): Promise<SmtpVerifyResult> {
    try {
      await this.transporter.verify();
      this.logger.log('SMTP verify: kết nối và xác thực thành công.');
      return { ok: true };
    } catch (error) {
      const raw = error instanceof Error ? error.message : String(error);
      this.logger.warn(`SMTP verify thất bại: ${raw}`);

      // Map lỗi xác thực Gmail (535) thành thông báo hướng dẫn rõ ràng
      if (
        raw.includes('535') ||
        raw.toLowerCase().includes('username and password not accepted') ||
        raw.toLowerCase().includes('invalid login')
      ) {
        return {
          ok: false,
          hint:
            'Xác thực SMTP thất bại (535 — Username and Password not accepted). ' +
            'Nếu dùng Gmail:\n' +
            '  1. Tài khoản phải bật 2FA.\n' +
            '  2. Tạo App Password tại https://myaccount.google.com/apppasswords\n' +
            '  3. Đặt SMTP_PASS = 16 ký tự KHÔNG có dấu cách (ví dụ: abcdefghijklmnop).\n' +
            '  4. Đảm bảo SMTP_USER = địa chỉ Gmail chính xác.',
        };
      }

      // Lỗi kết nối / timeout / TLS
      if (
        raw.toLowerCase().includes('econnrefused') ||
        raw.toLowerCase().includes('timeout') ||
        raw.toLowerCase().includes('enotfound')
      ) {
        return {
          ok: false,
          hint: `Không thể kết nối đến SMTP server. Kiểm tra SMTP_HOST và SMTP_PORT. (${raw})`,
        };
      }

      return { ok: false, hint: `SMTP error: ${raw}` };
    }
  }

  /**
   * Gửi email xác thực địa chỉ email khi đăng ký tài khoản mới.
   *
   * @throws Error nếu SMTP gửi thất bại (caller quyết định xử lý)
   */
  async sendVerificationEmail(
    payload: VerificationEmailPayload,
  ): Promise<void> {
    const { toEmail, toName, verifyUrl } = payload;

    const subject = '[Tasks Platform] Xác nhận địa chỉ email của bạn';

    const html = `
      <p>Xin chào <strong>${toName}</strong>,</p>
      <p>Cảm ơn bạn đã đăng ký tài khoản trên <strong>Tasks Management Platform</strong>.</p>
      <p>Vui lòng nhấn vào nút bên dưới để xác nhận địa chỉ email của bạn (link có hiệu lực trong <strong>24 giờ</strong>):</p>
      <p>
        <a href="${verifyUrl}" style="
          display:inline-block;
          padding:10px 20px;
          background:#3B82F6;
          color:#fff;
          text-decoration:none;
          border-radius:4px;
          font-weight:bold;
        ">Xác nhận Email</a>
      </p>
      <p>Hoặc copy đường dẫn sau vào trình duyệt:</p>
      <p><a href="${verifyUrl}">${verifyUrl}</a></p>
      <p>Nếu bạn không thực hiện đăng ký, vui lòng bỏ qua email này.</p>
      <hr/>
      <p style="font-size:12px;color:#888;">Tasks Management Platform</p>
    `;

    const text =
      `Xin chào ${toName},\n\n` +
      `Vui lòng truy cập đường dẫn sau để xác nhận email (hiệu lực 24 giờ):\n` +
      `${verifyUrl}\n\n` +
      `Nếu bạn không đăng ký, hãy bỏ qua email này.`;

    try {
      await this.transporter.sendMail({
        from: this.fromAddress,
        to: toEmail,
        subject,
        html,
        text,
      });

      this.logger.log(`Verification email sent to: ${toEmail}`);
    } catch (error) {
      this.logger.error(
        `Gửi email xác thực thất bại cho ${toEmail}`,
        error instanceof Error ? error.stack : String(error),
      );
      // Ném lại lỗi để caller quyết định xử lý (ví dụ: rollback hoặc bỏ qua)
      throw error;
    }
  }

  /**
   * Gửi email lời mời tham gia nhóm.
   *
   * Subject: "Bạn được mời vào nhóm {groupName}"
   * Body: tên người mời, tên nhóm, nút CTA trỏ đến inviteUrl (hiệu lực 48 giờ).
   *
   * @throws Error nếu SMTP gửi thất bại — caller chịu trách nhiệm xử lý
   */
  async sendGroupInviteEmail(payload: GroupInviteEmailPayload): Promise<void> {
    const { toEmail, groupName, inviterName, inviteUrl } = payload;

    const subject = `[Tasks Platform] Bạn được mời vào nhóm "${groupName}"`;

    const html = `
      <p>Xin chào,</p>
      <p><strong>${inviterName}</strong> đã mời bạn tham gia nhóm <strong>${groupName}</strong> trên <strong>Tasks Management Platform</strong>.</p>
      <p>Nhấn vào nút bên dưới để chấp nhận lời mời (link có hiệu lực trong <strong>48 giờ</strong>):</p>
      <p>
        <a href="${inviteUrl}" style="
          display:inline-block;
          padding:10px 20px;
          background:#3B82F6;
          color:#fff;
          text-decoration:none;
          border-radius:4px;
          font-weight:bold;
        ">Tham gia nhóm</a>
      </p>
      <p>Hoặc copy đường dẫn sau vào trình duyệt:</p>
      <p><a href="${inviteUrl}">${inviteUrl}</a></p>
      <p>Nếu bạn không muốn tham gia, vui lòng bỏ qua email này.</p>
      <hr/>
      <p style="font-size:12px;color:#888;">Tasks Management Platform</p>
    `;

    const text =
      `${inviterName} đã mời bạn tham gia nhóm "${groupName}"\n\n` +
      `Truy cập đường dẫn sau để chấp nhận (hiệu lực 48 giờ):\n` +
      `${inviteUrl}\n\n` +
      `Nếu bạn không muốn tham gia, hãy bỏ qua email này.`;

    try {
      await this.transporter.sendMail({
        from: this.fromAddress,
        to: toEmail,
        subject,
        html,
        text,
      });

      this.logger.log(`Group invite email sent to: ${toEmail}`);
    } catch (error) {
      this.logger.error(
        `Gửi email lời mời nhóm thất bại cho ${toEmail}`,
        error instanceof Error ? error.stack : String(error),
      );
      throw error;
    }
  }

  /**
   * Gửi email test đơn giản — chỉ dùng cho mục đích kiểm tra cấu hình SMTP.
   *
   * Flow:
   * 1. Gọi `verifyTransport()` để kiểm tra kết nối + xác thực trước.
   * 2. Nếu verify thất bại → throw Error với hint rõ ràng cho developer.
   * 3. Nếu verify thành công → gửi email test.
   *
   * @remarks TEMPORARY — method và endpoint này sẽ bị xoá trước khi deploy production.
   * @throws Error với thông báo có hint hướng dẫn nếu SMTP cấu hình sai
   */
  async sendTestEmail(
    toEmail: string,
    toName: string,
  ): Promise<SmtpVerifyResult> {
    // Bước 1: Kiểm tra kết nối + xác thực SMTP trước khi gửi
    const verify = await this.verifyTransport();
    if (!verify.ok) {
      // Ném lỗi với hint rõ ràng; caller (controller) sẽ trả về response hữu ích
      throw Object.assign(new Error(verify.hint ?? 'SMTP verify thất bại'), {
        smtpHint: verify.hint,
      });
    }

    const subject = '[Tasks Platform] Test Email';

    const html = `
      <p>Xin chào <strong>${toName}</strong>,</p>
      <p>Đây là email test từ <strong>Tasks Management Platform</strong> backend.</p>
      <p>Nếu bạn nhận được email này, cấu hình SMTP đang hoạt động đúng.</p>
      <hr/>
      <p style="font-size:12px;color:#888;">
        Email này được gửi từ endpoint tạm thời — chỉ dùng cho development.
      </p>
    `;

    const text =
      `Xin chào ${toName},\n\n` +
      `Đây là email test từ Tasks Management Platform backend.\n` +
      `Cấu hình SMTP đang hoạt động đúng.\n\n` +
      `(Email tạm thời — chỉ dùng cho development)`;

    // Bước 2: Gửi email sau khi verify thành công
    try {
      await this.transporter.sendMail({
        from: this.fromAddress,
        to: toEmail,
        subject,
        html,
        text,
      });

      this.logger.log(`Test email sent to: ${toEmail}`);
      return { ok: true };
    } catch (error) {
      const raw = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Gửi test email thất bại cho ${toEmail}: ${raw}`,
        error instanceof Error ? error.stack : undefined,
      );
      // verify() đã pass nhưng sendMail() thất bại — trả kết quả không ném exception
      // để controller có thể format response đầy đủ
      return {
        ok: false,
        hint: `Gửi thất bại sau khi verify thành công: ${raw}`,
      };
    }
  }

  /**
   * Gửi email nhắc nhở trước deadline.
   *
   * Subject: "[Nhắc hạn] Task "{title}" sắp đến hạn"
   * Được gọi bởi TaskNotificationService cron — KHÔNG expose qua HTTP endpoint.
   *
   * @param toEmail  - Địa chỉ nhận (assignee hoặc creator nếu không có assignee)
   * @param taskTitle - Tiêu đề task
   * @param deadline  - Thời điểm hết hạn
   * @param taskUrl   - Link đến task trên frontend (optional — bỏ qua nếu chưa có)
   */
  async sendTaskReminderEmail(
    toEmail: string,
    taskTitle: string,
    deadline: Date,
    taskUrl?: string,
  ): Promise<void> {
    const deadlineStr = deadline.toLocaleString('vi-VN', {
      timeZone: 'Asia/Ho_Chi_Minh',
      dateStyle: 'short',
      timeStyle: 'short',
    });

    const safeTitle = this.escapeHtml(taskTitle);
    const subject = `[Nhắc hạn] Task "${taskTitle}" sắp đến hạn`;

    const linkHtml = taskUrl
      ? `<p><a href="${taskUrl}" style="color:#3B82F6;">Xem task ngay</a></p>`
      : '';
    const linkText = taskUrl ? `Xem task: ${taskUrl}\n` : '';

    const html = `
      <p>Xin chào,</p>
      <p>Task <strong>"${safeTitle}"</strong> sẽ đến hạn lúc <strong>${deadlineStr}</strong>.</p>
      <p>Vui lòng hoàn thành đúng hạn!</p>
      ${linkHtml}
      <hr/>
      <p style="font-size:12px;color:#888;">Tasks Management Platform</p>
    `;

    const text =
      `Task "${taskTitle}" sẽ đến hạn lúc ${deadlineStr}.\n` +
      `Vui lòng hoàn thành đúng hạn!\n` +
      linkText;

    try {
      await this.transporter.sendMail({
        from: this.fromAddress,
        to: toEmail,
        subject,
        html,
        text,
      });
      this.logger.log(
        `Task reminder email sent to: ${toEmail} — "${taskTitle}"`,
      );
    } catch (error) {
      this.logger.error(
        `Gửi reminder email thất bại cho ${toEmail} (task: "${taskTitle}")`,
        error instanceof Error ? error.stack : String(error),
      );
      throw error;
    }
  }

  /**
   * Gửi email thông báo task đã quá hạn.
   *
   * Subject: "[Trễ hạn] Task "{title}" đã quá hạn"  ← khớp api-specification.md §6.2
   * Được gọi bởi TaskNotificationService cron — KHÔNG expose qua HTTP endpoint.
   *
   * @param toEmail   - Địa chỉ nhận (assignee hoặc creator nếu không có assignee)
   * @param taskTitle - Tiêu đề task
   * @param deadline  - Thời điểm hết hạn (đã qua)
   * @param taskUrl   - Link đến task trên frontend (optional)
   */
  async sendTaskOverdueEmail(
    toEmail: string,
    taskTitle: string,
    deadline: Date,
    taskUrl?: string,
  ): Promise<void> {
    const deadlineStr = deadline.toLocaleString('vi-VN', {
      timeZone: 'Asia/Ho_Chi_Minh',
      dateStyle: 'short',
      timeStyle: 'short',
    });

    const safeTitle = this.escapeHtml(taskTitle);
    const subject = `[Trễ hạn] Task "${taskTitle}" đã quá hạn`;

    const linkHtml = taskUrl
      ? `<p><a href="${taskUrl}" style="color:#EF4444;">Xem task ngay</a></p>`
      : '';
    const linkText = taskUrl ? `Xem task: ${taskUrl}\n` : '';

    const html = `
      <p>Xin chào,</p>
      <p>Task <strong>"${safeTitle}"</strong> đã <strong style="color:#EF4444;">quá hạn</strong> từ lúc ${deadlineStr}.</p>
      <p>Vui lòng xử lý hoặc cập nhật trạng thái task!</p>
      ${linkHtml}
      <hr/>
      <p style="font-size:12px;color:#888;">Tasks Management Platform</p>
    `;

    const text =
      `Task "${taskTitle}" đã quá hạn từ lúc ${deadlineStr}.\n` +
      `Vui lòng xử lý hoặc cập nhật trạng thái task!\n` +
      linkText;

    try {
      await this.transporter.sendMail({
        from: this.fromAddress,
        to: toEmail,
        subject,
        html,
        text,
      });
      this.logger.log(
        `Task overdue email sent to: ${toEmail} — "${taskTitle}"`,
      );
    } catch (error) {
      this.logger.error(
        `Gửi overdue email thất bại cho ${toEmail} (task: "${taskTitle}")`,
        error instanceof Error ? error.stack : String(error),
      );
      throw error;
    }
  }

  /**
   * Gửi email đặt lại mật khẩu.
   *
   * Subject: "[Tasks Platform] Đặt lại mật khẩu của bạn"
   * Body: nút CTA trỏ đến resetUrl (hiệu lực 1 giờ).
   *
   * @throws Error nếu SMTP gửi thất bại — caller chịu trách nhiệm xử lý
   */
  async sendPasswordResetEmail(
    toEmail: string,
    toName: string,
    resetUrl: string,
  ): Promise<void> {
    const safeToName = this.escapeHtml(toName);
    const subject = '[Tasks Platform] Đặt lại mật khẩu của bạn';

    const html = `
      <p>Xin chào <strong>${safeToName}</strong>,</p>
      <p>Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản của bạn trên <strong>Tasks Management Platform</strong>.</p>
      <p>Nhấn vào nút bên dưới để đặt mật khẩu mới (link có hiệu lực trong <strong>1 giờ</strong>):</p>
      <p>
        <a href="${resetUrl}" style="
          display:inline-block;
          padding:10px 20px;
          background:#EF4444;
          color:#fff;
          text-decoration:none;
          border-radius:4px;
          font-weight:bold;
        ">Đặt lại mật khẩu</a>
      </p>
      <p>Hoặc copy đường dẫn sau vào trình duyệt:</p>
      <p><a href="${resetUrl}">${resetUrl}</a></p>
      <p>Nếu bạn không yêu cầu đặt lại mật khẩu, vui lòng bỏ qua email này. Mật khẩu của bạn sẽ không thay đổi.</p>
      <hr/>
      <p style="font-size:12px;color:#888;">Tasks Management Platform</p>
    `;

    const text =
      `Xin chào ${toName},\n\n` +
      `Truy cập đường dẫn sau để đặt lại mật khẩu (hiệu lực 1 giờ):\n` +
      `${resetUrl}\n\n` +
      `Nếu bạn không yêu cầu, hãy bỏ qua email này.`;

    try {
      await this.transporter.sendMail({
        from: this.fromAddress,
        to: toEmail,
        subject,
        html,
        text,
      });
      this.logger.log(`Password reset email sent to: ${toEmail}`);
    } catch (error) {
      this.logger.error(
        `Gửi email đặt lại mật khẩu thất bại cho ${toEmail}`,
        error instanceof Error ? error.stack : String(error),
      );
      throw error;
    }
  }
}
