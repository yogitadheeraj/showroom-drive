import { Request, Response } from 'express';
import { getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { env } from '../config/env.js';
import { getCollectionModel } from '../models/collectionModel.js';

export async function meController(req: Request, res: Response) {
  if (!req.authUser?.uid) {
    res.status(401).json({ data: null, error: { message: 'Unauthorized' } });
    return;
  }

  const profiles = getCollectionModel('profiles');
  const userRoles = getCollectionModel('user_roles');

  const [profile, role] = await Promise.all([
    profiles.findOne({ user_id: req.authUser.uid }).lean(),
    userRoles.findOne({ user_id: req.authUser.uid }).lean(),
  ]);

  const roleValue = (role as { role?: string } | null)?.role || null;

  res.status(200).json({
    data: {
      user: {
        id: req.authUser.uid,
        email: req.authUser.email || null,
      },
      profile: profile || null,
      role: roleValue,
    },
    error: null,
  });
}

export async function resendVerificationController(req: Request, res: Response) {
  const email = String(req.body?.email || '').trim().toLowerCase();

  if (!email) {
    res.status(400).json({ data: null, error: { message: 'Email is required.' } });
    return;
  }

  if (!getApps().length) {
    res.status(503).json({ data: null, error: { message: 'Auth service is not configured.' } });
    return;
  }

  try {
    const user = await getAuth().getUserByEmail(email);

    if (user.emailVerified) {
      res.status(200).json({ data: { message: 'Email is already verified. You can sign in.' }, error: null });
      return;
    }

    const continueUrl = `${env.corsOrigin}/auth?verified=true`;
    const link = await getAuth().generateEmailVerificationLink(email, { url: continueUrl });

    res.status(200).json({ data: { message: 'Verification email sent.', link }, error: null });
  } catch (error: any) {
    const code = error?.errorInfo?.code || '';
    if (code === 'auth/user-not-found') {
      res.status(404).json({ data: null, error: { message: 'No account found with this email.' } });
      return;
    }
    res.status(500).json({ data: null, error: { message: error?.message || 'Failed to send verification email.' } });
  }
}
