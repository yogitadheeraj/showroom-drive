import nodemailer from 'nodemailer';
import { env } from '../config/env.js';

type MailInput = {
  to: string;
  subject: string;
  html: string;
  text?: string;
  _dealerName?: string; // Optional field for branding the "from" name
  attachments?: nodemailer.SendMailOptions['attachments'];
};

const STANDARD_SIGNATURE_TEXT = [
  '',
  'Regards,',
  'Team Auto Advant',
  'https://autoadvant.com',
].join('\n');

function appendStandardSignatureHtml(html: string) {
  const source = String(html || '');
  if (!source) return source;

  // Skip if already has a recognizable signature/footer.
  if (
    /data-auto-advant-signature="1"/i.test(source) ||
    /powered by\s*<a[^>]*>\s*autoadvant\.com\s*<\/a>/i.test(source) ||
    /team\s+auto\s+advant/i.test(source)
  ) {
    return source;
  }

  const signatureBlock = `
    <div data-auto-advant-signature="1" style="margin-top:20px;padding-top:12px;border-top:1px solid #e5e7eb;font-family:Arial,sans-serif;line-height:1.5;color:#4b5563;font-size:12px;">
      <p style="margin:0 0 4px;">Regards,</p>
      <p style="margin:0 0 4px;font-weight:600;color:#111827;">Team Auto Advant</p>
      <p style="margin:0;">Powered by <a href="https://autoadvant.com" target="_blank" rel="noopener noreferrer" style="color:#2563eb;text-decoration:none;">AutoAdvant.com</a></p>
    </div>
  `;

  if (/<\/body>/i.test(source)) {
    return source.replace(/<\/body>/i, `${signatureBlock}</body>`);
  }

  return `${source}${signatureBlock}`;
}

function appendStandardSignatureText(text?: string) {
  const base = String(text || '').trim();
  if (!base) return STANDARD_SIGNATURE_TEXT.trim();
  if (/team\s+auto\s+advant/i.test(base) || /autoadvant\.com/i.test(base)) return base;
  return `${base}${STANDARD_SIGNATURE_TEXT}`;
}

function smtpReady() {
  return Boolean(env.smtpHost && env.smtpPort && env.smtpUser && env.smtpPass && env.mailFrom);
}

let transporter: nodemailer.Transporter | null = null;

function getTransporter() {
  if (!smtpReady()) return null;
  if (transporter) return transporter;

  transporter = nodemailer.createTransport({
    host: env.smtpHost,
    port: env.smtpPort,
    secure: env.smtpSecure,
    auth: {
      user: env.smtpUser,
      pass: env.smtpPass,
    },
  });

  return transporter;
}

export async function sendMail(input: MailInput) {
  const tx = getTransporter();
  if (!tx) {
    console.warn('[mail] SMTP not configured. Skipping email send.');
    return { sent: false, skipped: true, reason: 'smtp_not_configured' };
  }

  try {
    const fromLabel = input._dealerName || env.mailFrom || 'Auto Dealer';
    const from = env.smtpUser ? `${fromLabel} <${env.smtpUser}>` : fromLabel;
    const normalizedHtml = appendStandardSignatureHtml(input.html);
    const normalizedText = appendStandardSignatureText(input.text);

    const info = await tx.sendMail({
      from,
      to: input.to,
      subject: input.subject,
      html: normalizedHtml,
      text: normalizedText,
      attachments: input.attachments,
    });
    console.log(`[mail] ✅ Sent → ${input.to} | subject: "${input.subject}" | msgId: ${info.messageId}`);
    return { sent: true, skipped: false };
  } catch (err: any) {
    console.error(`[mail] ❌ FAILED → ${input.to} | subject: "${input.subject}" | error: ${err?.message}`);
    if (err?.responseCode === 535) {
      console.error('[mail] SMTP auth failed (535). For Gmail, use a valid App Password and ensure 2-Step Verification is enabled.');
    }
    throw err;
  }
}

export function staffVerificationTemplate(params: {
  fullName: string;
  roleLabel: string;
  verificationLink: string;
  loginUrl: string;
}) {
  const { fullName, roleLabel, verificationLink, loginUrl } = params;
  const text = [
    `Hi ${fullName},`,
    '',
    `Your ${roleLabel} account has been created.`,
    'Please verify your email using the link below:',
    verificationLink,
    '',
    `After verification, log in here: ${loginUrl}`,
  ].join('\n');

  const html = `
    <div style="font-family: Arial, sans-serif; line-height:1.5; color:#111;">
      <h2 style="margin:0 0 12px;">Welcome to Auto Advant</h2>
      <p>Hi ${fullName},</p>
      <p>Your <strong>${roleLabel}</strong> account has been created.</p>
      <p>Please verify your email to activate access:</p>
      <p>
        <a href="${verificationLink}" style="display:inline-block;padding:10px 16px;background:#0f766e;color:#fff;text-decoration:none;border-radius:8px;">
          Verify Email
        </a>
      </p>
      <p>If the button does not work, open this link in your browser:</p>
      <p><a href="${verificationLink}">${verificationLink}</a></p>
      <hr style="border:none;border-top:1px solid #eee;margin:16px 0;" />
      <p>After verification, sign in here:</p>
      <p><a href="${loginUrl}">${loginUrl}</a></p>
    </div>
  `;

  return { text, html };
}
