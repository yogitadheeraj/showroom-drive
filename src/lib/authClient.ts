import { getAuth, createUserWithEmailAndPassword, sendEmailVerification, updateProfile } from 'firebase/auth';
import { apiPost } from '@/lib/apiClient';

export async function authSignUp(email: string, password: string, fullName: string) {
  const auth = getAuth();
  const result = await createUserWithEmailAndPassword(auth, email, password);

  if (fullName) {
    await updateProfile(result.user, { displayName: fullName });
  }

  await sendEmailVerification(result.user, {
    url: `${window.location.origin}/auth?verified=true`,
  });

  return { data: { user: result.user }, error: null };
}

export async function authResendSignupVerification(email: string) {
  await apiPost('/api/auth/resend-verification', { email: email.trim().toLowerCase() });
  return { data: {}, error: null };
}
