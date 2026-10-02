import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}

/**
 * Sends email over SMTP when SMTP_HOST is set (Mailpit in development, a real provider in production).
 *
 * Without SMTP it prints the message to the console so development still works, but never in
 * production: password-reset and verification links in a log file would be a security hole.
 */
@Injectable()
export class MailerService {
  private readonly log = new Logger('Mail');
  private readonly transport?: Transporter;
  readonly from = process.env.MAIL_FROM ?? 'Decors <no-reply@decors.local>';

  constructor() {
    if (process.env.SMTP_HOST) {
      this.transport = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT ?? 587),
        secure: process.env.SMTP_SECURE === 'true',
        auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS ?? '' } : undefined,
        // Fail fast instead of hanging a request when the mail server is down.
        connectionTimeout: 8000,
        greetingTimeout: 8000,
        socketTimeout: 15000,
      });
    }
  }

  async send(msg: MailMessage): Promise<void> {
    if (this.transport) {
      await this.transport.sendMail({ from: this.from, ...msg });
      return;
    }
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Email is not configured: set SMTP_HOST (and the other SMTP_* settings)');
    }
    this.log.log(`SMTP is not configured, so this email is only printed (development):\nTo: ${msg.to}\nSubject: ${msg.subject}\n\n${msg.text}\n`);
  }
}
