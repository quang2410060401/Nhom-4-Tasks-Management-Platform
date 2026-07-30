import { Module } from '@nestjs/common';
import { MailService } from './mail.service';

/**
 * MailModule — module dùng chung, export MailService để các module khác inject.
 *
 * Import vào module cần gửi email:
 *   imports: [MailModule]
 */
@Module({
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}
