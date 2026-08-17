import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  signOut as firebaseSignOut,
  updateProfile,
  onIdTokenChanged,
} from 'firebase/auth';
import { firebaseAuth, type Session, type User } from '@/integrations/supabase/client';
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
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, fullName: string) => Promise<void>;
  resendVerificationEmail: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be within AuthProvider');
  return ctx;
};

export const useAuthOptional = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [profile, setProfile] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

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
    const unsubscribe = onIdTokenChanged(firebaseAuth, async (firebaseUser) => {
      if (firebaseUser) {
        const mappedUser: User = { id: firebaseUser.uid, email: firebaseUser.email, user_metadata: { full_name: firebaseUser.displayName } };
        const token = await firebaseUser.getIdToken();
        const session: Session = { user: mappedUser, access_token: token };
        setSession(session);
        setUser(mappedUser);
        setTimeout(() => fetchUserData(mappedUser), 0);
      } else {
        setSession(null);
        setUser(null);
        setRole(null);
        setProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
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

    await firebaseSignOut(firebaseAuth);
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

  return (
    <AuthContext.Provider value={{ user, session, role, profile, loading, signIn, signUp, resendVerificationEmail, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
};
