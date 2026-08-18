import { createUserWithEmailAndPassword, sendEmailVerification, updateProfile } from 'firebase/auth';
import { apiPost } from '@/lib/apiClient';
import { firebaseAuth, isFirebaseClientConfigured } from '@/integrations/supabase/client';

export async function authSignUp(email: string, password: string, fullName: string) {
  if (!firebaseAuth || !isFirebaseClientConfigured) {
    return { data: null, error: { message: 'Authentication is not configured for this environment.' } };
  }

  const result = await createUserWithEmailAndPassword(firebaseAuth, email, password);
  if (fullName) {
    await updateProfile(result.user, { displayName: fullName });
  }
  await sendEmailVerification(result.user, {
    url: `${window.location.origin}/auth`,
    handleCodeInApp: false,
  });
  return { data: { user: result.user }, error: null };
}

export async function authResendSignupVerification(email: string) {
  await apiPost('/api/auth/resend-verification', { email: email.trim().toLowerCase() });
  return { data: {}, error: null };
}
