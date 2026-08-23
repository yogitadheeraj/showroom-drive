import { randomUUID } from 'node:crypto';
import { sendMail } from './mailService.js';
import { ServiceBookingOtp } from '../models/ServiceBookingOtp.js';
import { Customer } from '../models/Customer.js';

const OTP_TTL_MINUTES = 10;
const VERIFY_TOKEN_TTL_MINUTES = 30;

function normalizePhone(value: string) {
  return String(value || '').replace(/\s+/g, '').trim();
}

function generateOtpCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function addMinutesIso(minutes: number) {
  return new Date(Date.now() + minutes * 60_000).toISOString();
}

function maskEmail(email: string | null | undefined) {
  if (!email) return 'No email on file';
  const [local, domain] = email.split('@');
  if (!local || !domain) return email;
  const shown = local.slice(0, 2);
  return `${shown}${'*'.repeat(Math.max(1, local.length - 2))}@${domain}`;
}

async function sendOtpEmail(email: string, code: string, phone: string) {
  const subject = 'Your Service Booking OTP';
  const html = `
<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#111">
  <h2 style="margin:0 0 12px">Service Booking Verification</h2>
  <p>Use the OTP below to view your service bookings for mobile number <strong>${phone}</strong>.</p>
  <p style="font-size:28px;letter-spacing:6px;font-weight:700;margin:20px 0">${code}</p>
  <p>This OTP expires in ${OTP_TTL_MINUTES} minutes.</p>
  <p style="color:#666;font-size:12px">If you did not request this code, you can ignore this email.</p>
</div>`;

  await sendMail({ to: email, subject, html });
}

export async function requestServiceBookingOtp(phoneRaw: string) {
  const phone = normalizePhone(phoneRaw);
  if (!phone) throw new Error('Phone is required.');

  const customer = await Customer.findOne({ phone }, { email: 1 }).lean() as any;
  const email = String(customer?.email || '').trim().toLowerCase();
  if (!email) {
    throw new Error('No customer email found for this mobile number. Please create a booking first with email.');
  }

  const code = generateOtpCode();
  const now = new Date().toISOString();

  const doc = new ServiceBookingOtp({
    id: randomUUID(),
    phone,
    code,
    purpose: 'lookup',
    attempts: 0,
    max_attempts: 5,
    expires_at: addMinutesIso(OTP_TTL_MINUTES),
    verified_at: null,
    verification_token: null,
    verification_expires_at: null,
    created_at: now,
    updated_at: now,
  });

  await doc.save();
  await sendOtpEmail(email, code, phone);

  return {
    success: true,
    delivery: 'email',
    masked_destination: maskEmail(email),
    expires_in_minutes: OTP_TTL_MINUTES,
  };
}

export async function verifyServiceBookingOtp(phoneRaw: string, otpRaw: string) {
  const phone = normalizePhone(phoneRaw);
  const otp = String(otpRaw || '').trim();
  if (!phone || !otp) throw new Error('Phone and OTP are required.');

  const nowIso = new Date().toISOString();

  const latest = await ServiceBookingOtp.findOne({
    phone,
    purpose: 'lookup',
  }).sort({ created_at: -1 }).lean() as any;

  if (!latest) throw new Error('OTP not found. Please request a new OTP.');

  if (latest.verified_at) {
    throw new Error('OTP already used. Please request a new OTP.');
  }

  if (new Date(latest.expires_at).getTime() < Date.now()) {
    throw new Error('OTP expired. Please request a new OTP.');
  }

  if (latest.attempts >= latest.max_attempts) {
    throw new Error('Too many attempts. Please request a new OTP.');
  }

  if (latest.code !== otp) {
    await ServiceBookingOtp.updateOne(
      { id: latest.id },
      { $set: { updated_at: nowIso }, $inc: { attempts: 1 } },
    );
    throw new Error('Invalid OTP.');
  }

  const verificationToken = randomUUID();

  await ServiceBookingOtp.updateOne(
    { id: latest.id },
    {
      $set: {
        verified_at: nowIso,
        verification_token: verificationToken,
        verification_expires_at: addMinutesIso(VERIFY_TOKEN_TTL_MINUTES),
        updated_at: nowIso,
      },
    },
  );

  return {
    verified: true,
    verification_token: verificationToken,
    expires_in_minutes: VERIFY_TOKEN_TTL_MINUTES,
  };
}

export async function validateServiceBookingVerificationToken(phoneRaw: string, tokenRaw: string) {
  const phone = normalizePhone(phoneRaw);
  const token = String(tokenRaw || '').trim();
  if (!phone || !token) return false;

  const latest = await ServiceBookingOtp.findOne({
    phone,
    purpose: 'lookup',
    verification_token: token,
  }).sort({ created_at: -1 }).lean() as any;

  if (!latest?.verification_token || !latest?.verification_expires_at) {
    return false;
  }

  return new Date(latest.verification_expires_at).getTime() > Date.now();
}
