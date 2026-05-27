import { Request, Response, NextFunction } from 'express';
import { verifyIdToken } from '../config/firebaseAdmin.js';

declare global {
  namespace Express {
    interface Request {
      authUser?: {
        uid: string;
        email?: string;
      };
    }
  }
}

export async function attachAuthUser(req: Request, _res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    next();
    return;
  }

  const token = authHeader.slice('Bearer '.length).trim();

  try {
    const decoded = await verifyIdToken(token);
    req.authUser = {
      uid: decoded.uid,
      email: decoded.email,
    };
  } catch {
    // Allow anonymous requests for public endpoints.
  }

  next();
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.authUser?.uid) {
    res.status(401).json({ error: { message: 'Unauthorized' } });
    return;
  }

  next();
}
