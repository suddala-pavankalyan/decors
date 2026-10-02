import type { MailMessage } from './mailer.service';

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

function layout(title: string, bodyHtml: string, button?: { label: string; href: string }) {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body style="margin:0;background:#fdf6f1;font-family:Inter,'Segoe UI',Roboto,Arial,sans-serif;color:#1e293b">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:20px;padding:32px">
<tr><td>
<p style="margin:0 0 20px;font-size:20px;font-weight:800;letter-spacing:-0.02em">Decors</p>
<h1 style="margin:0 0 12px;font-size:22px;line-height:1.25">${esc(title)}</h1>
${bodyHtml}
${button ? `<p style="margin:24px 0"><a href="${esc(button.href)}" style="display:inline-block;background:#d62976;color:#ffffff;text-decoration:none;font-weight:600;padding:12px 24px;border-radius:999px">${esc(button.label)}</a></p>
<p style="margin:0 0 8px;font-size:13px;color:#64748b">Button not working? Copy this link into your browser:<br><span style="word-break:break-all">${esc(button.href)}</span></p>` : ''}
</td></tr></table>
<p style="margin:16px 0 0;font-size:12px;color:#94a3b8">Decors &middot; You are receiving this because of activity on your account.</p>
</td></tr></table></body></html>`;
}

export function verifyEmailMessage(to: string, name: string, link: string): MailMessage {
  return {
    to,
    subject: 'Confirm your email address',
    text: `Hi ${name},\n\nWelcome to Decors! Please confirm your email address so you can place orders:\n\n${link}\n\nThis link works for 24 hours. If you did not create an account, you can ignore this email.\n`,
    html: layout('Confirm your email address', `<p style="margin:0;line-height:1.6">Hi ${esc(name)}, welcome to Decors! Please confirm your email address so you can place orders. This link works for 24 hours.</p>`, { label: 'Confirm my email', href: link }),
  };
}

export function resetPasswordMessage(to: string, name: string, link: string): MailMessage {
  return {
    to,
    subject: 'Reset your Decors password',
    text: `Hi ${name},\n\nWe received a request to reset your password. Use this link to choose a new one:\n\n${link}\n\nIt works for 1 hour and can be used once. If you did not ask for this, you can ignore this email; your password will not change.\n`,
    html: layout('Reset your password', `<p style="margin:0;line-height:1.6">Hi ${esc(name)}, we received a request to reset your password. The link works for 1 hour and can be used once. If you did not ask for this, you can ignore this email and your password will stay as it is.</p>`, { label: 'Choose a new password', href: link }),
  };
}

export function passwordChangedMessage(to: string, name: string, supportLink: string): MailMessage {
  return {
    to,
    subject: 'Your Decors password was changed',
    text: `Hi ${name},\n\nThe password for your Decors account was just changed, and you were signed out everywhere.\n\nIf this was you, there is nothing more to do. If it was not, reset your password right away: ${supportLink}\n`,
    html: layout('Your password was changed', `<p style="margin:0;line-height:1.6">Hi ${esc(name)}, the password for your Decors account was just changed and you were signed out everywhere. If this was you, there is nothing more to do. If it was not, reset your password right away.</p>`, { label: 'Reset my password', href: supportLink }),
  };
}
