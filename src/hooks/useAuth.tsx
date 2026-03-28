import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
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
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be within AuthProvider');
  return ctx;
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [profile, setProfile] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  const ensureUserProfile = async (authUser: User) => {
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', authUser.id)
      .maybeSingle();

    if (existingProfile) return existingProfile;

    await supabase.from('profiles').insert({
      user_id: authUser.id,
      full_name: (authUser.user_metadata?.full_name as string | undefined) || authUser.email || 'New User',
      email: authUser.email || '',
    } as never);

    const { data: createdProfile } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', authUser.id)
      .maybeSingle();

    return createdProfile;
  };

  const fetchUserData = async (authUser: User) => {
    const [{ data: roleData }, profileData] = await Promise.all([
      supabase.from('user_roles').select('role').eq('user_id', authUser.id).maybeSingle(),
      ensureUserProfile(authUser),
    ]);
    const resolvedRole = isAppRole(roleData?.role) ? roleData.role : null;
    setRole(resolvedRole);
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
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          setTimeout(() => fetchUserData(session.user), 0);
        } else {
          setRole(null);
          setProfile(null);
        }
        setLoading(false);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) fetchUserData(session.user);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      if (/email\s+not\s+confirmed/i.test(error.message)) {
        throw new Error('Email not verified yet. Please verify from your inbox or resend verification email.');
      }
      throw error;
    }

    if (data.user) {
      const { data: profileData } = await supabase
        .from('profiles')
        .select('id, is_active')
        .eq('user_id', data.user.id)
        .maybeSingle();

      if (!profileData) {
        await ensureUserProfile(data.user);
      }

      if (profileData?.is_active === false) {
        await supabase.auth.signOut();
        throw new Error('Your account is blocked. Contact superadmin.');
      }

      await supabase
        .from('profiles')
        .update({ last_login_at: new Date().toISOString() } as never)
        .eq('user_id', data.user.id);
    }
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    const { error } = await supabase.auth.signUp({
      email, password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo: `${window.location.origin}/auth`,
      },
    });
    if (error) throw error;
  };

  const resendVerificationEmail = async (email: string) => {
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth`,
      },
    });

    if (error) throw error;
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

    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setRole(null);
    setProfile(null);
  };

  return (
    <AuthContext.Provider value={{ user, session, role, profile, loading, signIn, signUp, resendVerificationEmail, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};
