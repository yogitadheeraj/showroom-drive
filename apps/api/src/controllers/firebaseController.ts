import { Request, Response } from 'express';
import * as firebaseService from '../services/firebaseService.js';
import { env } from '../config/env.js';
import { sendMail } from '../services/mailService.js';

function passwordChangedTemplate(params: { fullName: string; loginUrl: string }) {
  const { fullName, loginUrl } = params;
  const text = [
    `Hi ${fullName},`,
    '',
    'Your account password was changed successfully.',
    'If you did not make this change, please reset your password immediately and contact support.',
    '',
    `Login URL: ${loginUrl}`,
  ].join('\n');

  const html = `
    <div style="font-family: Arial, sans-serif; line-height:1.5; color:#111;">
      <h2 style="margin:0 0 12px;">Password Changed</h2>
      <p>Hi ${fullName},</p>
      <p>Your account password was changed successfully.</p>
      <p>If you did not make this change, please reset your password immediately and contact support.</p>
      <p><a href="${loginUrl}">${loginUrl}</a></p>
    </div>
  `;

  return { text, html };
}

export async function createUserController(req: Request, res: Response) {
  const { email, password, displayName, disabled } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'email and password are required' });
  const user = await firebaseService.createFirebaseUser({ email, password, displayName, disabled });
  res.status(201).json({ uid: user.uid, email: user.email, displayName: user.displayName });
}

export async function updateUserController(req: Request, res: Response) {
  const { uid } = req.params;
  const updates = req.body;
  const shouldNotifyPasswordChanged = typeof updates?.password === 'string' && updates.password.trim().length > 0;
  const user = await firebaseService.updateFirebaseUser(uid, updates);

  if (shouldNotifyPasswordChanged && user.email) {
    const template = passwordChangedTemplate({
      fullName: user.displayName || 'there',
      loginUrl: `${env.corsOrigin}/auth`,
    });
    try {
      await sendMail({
        to: user.email,
        subject: 'Your Auto Advant password was changed',
        html: template.html,
        text: template.text,
      });
    } catch {
      // Non-blocking: password update is already successful.
    }
  }

  res.json({ uid: user.uid, email: user.email, displayName: user.displayName, disabled: user.disabled });
}

export async function disableUserController(req: Request, res: Response) {
  await firebaseService.disableFirebaseUser(req.params.uid);
  res.json({ success: true });
}

export async function enableUserController(req: Request, res: Response) {
  await firebaseService.enableFirebaseUser(req.params.uid);
  res.json({ success: true });
}

export async function deleteUserController(req: Request, res: Response) {
  await firebaseService.deleteFirebaseUser(req.params.uid);
  res.status(204).end();
}

export async function getUserController(req: Request, res: Response) {
  const user = await firebaseService.getFirebaseUser(req.params.uid);
  res.json({ uid: user.uid, email: user.email, displayName: user.displayName, disabled: user.disabled, emailVerified: user.emailVerified });
}

export async function setCustomClaimsController(req: Request, res: Response) {
  const { uid } = req.params;
  const { role, location_id, dealer_id } = req.body;
  await firebaseService.setCustomClaims(uid, { role, location_id, dealer_id });
  res.json({ success: true });
}

export async function sendTestDriveNotificationController(req: Request, res: Response) {
  const { status, ...ctx } = req.body;
  if (!status) return res.status(400).json({ error: 'status is required' });
  await firebaseService.notifyTestDriveStatusChange(status, ctx);
  res.json({ success: true });
}
