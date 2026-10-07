import { Request, Response } from 'express';
import { getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { env } from '../config/env.js';
import { getCollectionModel } from '../models/collectionModel.js';
import { sendMail, staffVerificationTemplate } from '../services/mailService.js';

const SUPERADMIN_ROLES = new Set(['superadmin', 'super_admin']);
const SWITCHER_ROLES = new Set(['superadmin', 'super_admin', 'dealer_admin', 'sales_admin', 'branch_admin']);

const normalizeRole = (value: unknown) => String(value || '').trim().toLowerCase();

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
    const template = staffVerificationTemplate({
      fullName: user.displayName || 'there',
      roleLabel: 'Organization Admin',
      verificationLink: link,
      loginUrl: `${env.corsOrigin}/auth`,
    });

    const mailStatus = await sendMail({
      to: email,
      subject: 'Verify your account to sign in',
      html: template.html,
      text: template.text,
    });

    res.status(200).json({
      data: {
        message: mailStatus.sent ? 'Verification email sent.' : 'Verification link generated. Email send skipped.',
        sent: mailStatus.sent,
        skipped: mailStatus.skipped,
        link: mailStatus.sent ? null : link,
      },
      error: null,
    });
  } catch (error: any) {
    const code = error?.errorInfo?.code || '';
    if (code === 'auth/user-not-found') {
      res.status(404).json({ data: null, error: { message: 'No account found with this email.' } });
      return;
    }
    res.status(500).json({ data: null, error: { message: error?.message || 'Failed to send verification email.' } });
  }
}

export async function switchUserController(req: Request, res: Response) {
  if (!req.authUser?.uid) {
    res.status(401).json({ data: null, error: { message: 'Unauthorized' } });
    return;
  }

  const targetUserId = String(req.body?.targetUserId || '').trim();
  if (!targetUserId) {
    res.status(400).json({ data: null, error: { message: 'targetUserId is required.' } });
    return;
  }

  if (!getApps().length) {
    res.status(503).json({ data: null, error: { message: 'Auth service is not configured.' } });
    return;
  }

  const currentUid = req.authUser.uid;
  const currentRole = normalizeRole(req.authUser.role);
  const isCurrentSuperadmin = SUPERADMIN_ROLES.has(currentRole);
  const rootUid = req.authUser.impersonation_root_uid || null;
  const requesterLocationId = req.authUser.location_id || null;
  const requesterDealerId = req.authUser.dealer_id || null;

  let allowSwitch = false;
  let claims: Record<string, unknown> = {};

  const userRoles = getCollectionModel('user_roles');
  const profiles = getCollectionModel('profiles');
  const locations = getCollectionModel('locations');

  const requesterRootUid = rootUid || currentUid;

  const getRoleByUserId = async (uid: string) => {
    const doc = await userRoles.findOne({ user_id: uid }).lean();
    return normalizeRole((doc as any)?.role);
  };

  const getProfileByUserId = async (uid: string) => {
    return profiles.findOne({ user_id: uid }).lean();
  };

  const getDealerIdByLocationId = async (locationId: string | null | undefined) => {
    if (!locationId) return null;
    const doc = await locations.findOne({ id: locationId }, { dealer_id: 1 }).lean();
    return ((doc as any)?.dealer_id as string | null) || null;
  };

  if (rootUid && targetUserId === rootUid) {
    const rootRole = await getRoleByUserId(rootUid);
    if (SWITCHER_ROLES.has(rootRole)) {
      allowSwitch = true;
      claims = {};
    }
  } else if (SWITCHER_ROLES.has(currentRole)) {
    if (targetUserId === currentUid) {
      allowSwitch = true;
      claims = {};
    } else if (isCurrentSuperadmin) {
      allowSwitch = true;
    } else {
      const [targetRole, targetProfile] = await Promise.all([
        getRoleByUserId(targetUserId),
        getProfileByUserId(targetUserId),
      ]);

      const isTargetSuperadmin = SUPERADMIN_ROLES.has(targetRole);

      if (!isTargetSuperadmin) {
        if (currentRole === 'dealer_admin') {
          const targetDealerId = await getDealerIdByLocationId((targetProfile as any)?.location_id || null);
          allowSwitch = !!targetDealerId && !!requesterDealerId && targetDealerId === requesterDealerId;
        } else if (currentRole === 'sales_admin' || currentRole === 'branch_admin') {
          const targetRoleBlocked = targetRole === 'dealer_admin';
          const targetLocationId = ((targetProfile as any)?.location_id as string | null) || null;
          allowSwitch = !targetRoleBlocked && !!requesterLocationId && targetLocationId === requesterLocationId;
        }
      }
    }

    if (allowSwitch) {
      const switchingToRoot = targetUserId === requesterRootUid;
      const switchingToSelf = targetUserId === currentUid;
      claims = switchingToRoot || switchingToSelf
        ? {}
        : {
            impersonated_by: currentUid,
            impersonation_root_uid: requesterRootUid,
            impersonation_started_at: new Date().toISOString(),
          };
    }
  }

  if (!allowSwitch) {
    res.status(403).json({ data: null, error: { message: 'You are not allowed to switch to this user.' } });
    return;
  }

  try {
    await getAuth().getUser(targetUserId);
  } catch (error: any) {
    const code = error?.errorInfo?.code || '';
    if (code === 'auth/user-not-found') {
      res.status(404).json({ data: null, error: { message: 'Target auth user not found.' } });
      return;
    }
    res.status(500).json({ data: null, error: { message: error?.message || 'Failed to validate target user.' } });
    return;
  }

  try {
    const customToken = await getAuth().createCustomToken(targetUserId, claims);
    res.status(200).json({ data: { customToken }, error: null });
  } catch (error: any) {
    res.status(500).json({ data: null, error: { message: error?.message || 'Failed to switch user.' } });
  }
}
