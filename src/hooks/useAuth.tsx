import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import {
  signInWithEmailAndPassword,
  signInWithCustomToken,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  signOut as firebaseSignOut,
  updateProfile,
  onIdTokenChanged,
} from 'firebase/auth';
import { firebaseAuth, isFirebaseClientConfigured, type Session, type User } from '@/integrations/supabase/client';
import { apiGet, apiPatch, apiPost } from '@/lib/apiClient';
import { AppRole } from '@/constants/roles';
import { isAppRole } from '@/lib/roles';
import { ensureActivitySession, endActivitySession } from '@/lib/activityLogger';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  role: AppRole | null;
  profile: any | null;
  loading: boolean;
  isImpersonating: boolean;
  impersonationContext: {
    rootName: string | null;
    targetName: string | null;
    startedAt: string | null;
  } | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, fullName: string) => Promise<void>;
  resendVerificationEmail: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  switchToUser: (params: { targetUserId: string; targetName?: string }) => Promise<void>;
  switchBackToSuperadmin: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be within AuthProvider');
  return ctx;
};

export const useAuthOptional = () => useContext(AuthContext);

const IMPERSONATION_STORAGE_KEY = 'impersonation_context_v1';

type ImpersonationContext = {
  rootUserId: string;
  rootEmail: string | null;
  rootName: string | null;
  targetUserId: string;
  targetName: string | null;
  startedAt: string;
};

const readImpersonationContext = (): ImpersonationContext | null => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(IMPERSONATION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ImpersonationContext;
    if (!parsed?.rootUserId || !parsed?.targetUserId) return null;
    return parsed;
  } catch {
    return null;
  }
};

const writeImpersonationContext = (value: ImpersonationContext | null) => {
  if (typeof window === 'undefined') return;
  if (!value) {
    window.localStorage.removeItem(IMPERSONATION_STORAGE_KEY);
    return;
  }
  window.localStorage.setItem(IMPERSONATION_STORAGE_KEY, JSON.stringify(value));
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [profile, setProfile] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [isImpersonating, setIsImpersonating] = useState(false);
  const [impersonationContext, setImpersonationContext] = useState<{
    rootName: string | null;
    targetName: string | null;
    startedAt: string | null;
  } | null>(null);

  const ensureUserProfile = async (authUser: User) => {
    // Profile is managed by the backend — just fetch via API
    const me = await apiGet<{ user: User; profile: any; role: string | null }>('/api/auth/me').catch(() => null);
    return me?.profile ?? null;
  };

  const fetchUserData = async (authUser: User) => {
    const me = await apiGet<{ user: User; profile: any; role: string | null }>('/api/auth/me').catch(() => null);
    const resolvedRole = isAppRole(me?.role) ? me!.role as AppRole : null;
    setRole(resolvedRole);
    const profileData = me?.profile ?? null;
    setProfile(profileData);

    if (profileData) {
      await ensureActivitySession({
        userId: authUser.id,
        profileId: profileData.id,
        locationId: profileData.location_id,
        role: resolvedRole,
      });
    }
  };

  useEffect(() => {
    if (!firebaseAuth || !isFirebaseClientConfigured) {
      setLoading(false);
      return;
    }

    const unsubscribe = onIdTokenChanged(firebaseAuth, async (firebaseUser) => {
      if (firebaseUser) {
        const mappedUser: User = { id: firebaseUser.uid, email: firebaseUser.email, user_metadata: { full_name: firebaseUser.displayName } };
        const token = await firebaseUser.getIdToken();
        const session: Session = { user: mappedUser, access_token: token };
        setSession(session);
        setUser(mappedUser);

        const ctx = readImpersonationContext();
        if (ctx?.targetUserId === mappedUser.id) {
          setIsImpersonating(true);
          setImpersonationContext({
            rootName: ctx.rootName ?? null,
            targetName: ctx.targetName ?? null,
            startedAt: ctx.startedAt ?? null,
          });
        } else if (ctx?.rootUserId === mappedUser.id) {
          writeImpersonationContext(null);
          setIsImpersonating(false);
          setImpersonationContext(null);
        } else {
          setIsImpersonating(false);
          setImpersonationContext(null);
        }

        setTimeout(() => fetchUserData(mappedUser), 0);
      } else {
        setSession(null);
        setUser(null);
        setRole(null);
        setProfile(null);
        setIsImpersonating(false);
        setImpersonationContext(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    if (!firebaseAuth || !isFirebaseClientConfigured) {
      throw new Error('Authentication is not configured for this environment USE AUTH.');
    }

    const credentials = await signInWithEmailAndPassword(firebaseAuth, email, password);
    if (!credentials.user.emailVerified) {
      await firebaseSignOut(firebaseAuth);
      throw new Error('Email not verified yet. Please verify from your inbox or resend verification email.');
    }
    // Check profile active status
    const me = await apiGet<{ profile: any }>('/api/auth/me').catch(() => null);
    if (me?.profile?.is_active === false) {
      await firebaseSignOut(firebaseAuth);
      throw new Error('Your account is blocked. Contact superadmin.');
    }
    // Update last login (best-effort)
    if (me?.profile?.id) {
      apiPatch(`/api/profiles/${me.profile.id}`, { last_login_at: new Date().toISOString() }).catch(() => null);
    }
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    if (!firebaseAuth || !isFirebaseClientConfigured) {
      throw new Error('Authentication is not configured for this environment USE AUTH 2.');
    }

    const credentials = await createUserWithEmailAndPassword(firebaseAuth, email, password);
    if (fullName && credentials.user) {
      await updateProfile(credentials.user, { displayName: fullName });
    }
    if (credentials.user) {
      const continueUrl = `${window.location.origin}/auth?verified=true`;
      await sendEmailVerification(credentials.user, { url: continueUrl });
      await firebaseSignOut(firebaseAuth);
    }
  };

  const resendVerificationEmail = async (email: string) => {
    await apiPost('/api/auth/resend-verification', { email });
  };

  const signOut = async () => {
      if (user) {
      await endActivitySession({
        userId: user.id,
        profileId: profile?.id,
        locationId: profile?.location_id,
        role,
      });
    }

    if (firebaseAuth && isFirebaseClientConfigured) {
      await firebaseSignOut(firebaseAuth);
    }
    writeImpersonationContext(null);
    setIsImpersonating(false);
    setImpersonationContext(null);
    setUser(null);
    setSession(null);
    setRole(null);
    setProfile(null);
  };

  const refreshProfile = async () => {
    if (!user) return;
    const me = await apiGet<{ profile: any }>('/api/auth/me').catch(() => null);
    if (me?.profile) setProfile(me.profile);
  };

  const switchToUser = async (params: { targetUserId: string; targetName?: string }) => {
    if (!firebaseAuth || !isFirebaseClientConfigured) {
      throw new Error('Authentication is not configured for user switch.');
    }
    if (!user?.id) {
      throw new Error('Current user session not found.');
    }

    const currentContext = readImpersonationContext();
    const rootUserId = currentContext?.rootUserId || user.id;
    const rootEmail = currentContext?.rootEmail || user.email || null;
    const rootName = currentContext?.rootName || profile?.full_name || user.user_metadata?.full_name || null;

    const data = await apiPost<{ customToken: string }>('/api/auth/switch-user', {
      targetUserId: params.targetUserId,
    });

    const customToken = String(data?.customToken || '').trim();
    if (!customToken) {
      throw new Error('Switch token was not returned by server.');
    }

    writeImpersonationContext({
      rootUserId,
      rootEmail,
      rootName,
      targetUserId: params.targetUserId,
      targetName: params.targetName || null,
      startedAt: new Date().toISOString(),
    });

    await signInWithCustomToken(firebaseAuth, customToken);
    setIsImpersonating(true);
    setImpersonationContext({
      rootName,
      targetName: params.targetName || null,
      startedAt: new Date().toISOString(),
    });
  };

  const switchBackToSuperadmin = async () => {
    if (!firebaseAuth || !isFirebaseClientConfigured) {
      throw new Error('Authentication is not configured for user switch.');
    }

    const ctx = readImpersonationContext();
    if (!ctx?.rootUserId) {
      throw new Error('No impersonation session found.');
    }

    const data = await apiPost<{ customToken: string }>('/api/auth/switch-user', {
      targetUserId: ctx.rootUserId,
    });

    const customToken = String(data?.customToken || '').trim();
    if (!customToken) {
      throw new Error('Switch-back token was not returned by server.');
    }

    await signInWithCustomToken(firebaseAuth, customToken);
    writeImpersonationContext(null);
    setIsImpersonating(false);
    setImpersonationContext(null);
  };

  return (
    <AuthContext.Provider value={{ user, session, role, profile, loading, isImpersonating, impersonationContext, signIn, signUp, resendVerificationEmail, signOut, refreshProfile, switchToUser, switchBackToSuperadmin }}>
      {children}
    </AuthContext.Provider>
  );
};
