import { initializeApp, getApps } from 'firebase/app';
import {
  createUserWithEmailAndPassword,
  getAuth,
  onIdTokenChanged,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  updateProfile,
  type User as FirebaseUser,
} from 'firebase/auth';
import { getApiBaseUrl } from '@/lib/getApiBaseUrl';

type DbFilterOp = 'eq' | 'neq' | 'in' | 'not_in' | 'gt' | 'gte' | 'lt' | 'lte' | 'like' | 'ilike' | 'is';
type DbAction = 'select' | 'insert' | 'update' | 'delete' | 'upsert';

export type User = {
  id: string;
  email: string | null;
  user_metadata?: Record<string, unknown>;
};

export type Session = {
  user: User;
  access_token: string;
};

type SupaResult<T> = Promise<
  | { data: T; error: null; count?: number | null }
  | { data: null; error: { message: string }; count?: number | null }
>;

type SupportedLocale = 'en' | 'hi';

const API_BASE_URL = getApiBaseUrl();

const normalizePublicEnv = (value?: string) => {
  if (!value) return '';
  const trimmed = value.trim();
  return trimmed.replace(/^['\"]+|['\"]+$/g, '');
};

const firebaseConfig = {
  apiKey: normalizePublicEnv(process.env.NEXT_PUBLIC_FIREBASE_API_KEY || process.env.VITE_FIREBASE_API_KEY),
  authDomain: normalizePublicEnv(process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || process.env.VITE_FIREBASE_AUTH_DOMAIN),
  projectId: normalizePublicEnv(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID),
  appId: normalizePublicEnv(process.env.NEXT_PUBLIC_FIREBASE_APP_ID || process.env.VITE_FIREBASE_APP_ID),
  messagingSenderId: normalizePublicEnv(
    process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  ),
  databaseURL: normalizePublicEnv(process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL || process.env.VITE_FIREBASE_DATABASE_URL),
};
console.log('Firebase config:', {
  firebaseConfig,
  process:process.env
});
export const isFirebaseClientConfigured = Boolean(
  firebaseConfig.apiKey &&
  firebaseConfig.authDomain &&
  firebaseConfig.projectId &&
  firebaseConfig.appId
);

const FIREBASE_ERROR_MESSAGES: Record<SupportedLocale, Record<string, string>> = {
  en: {
    EMAIL_EXISTS: 'This email is already registered. Please sign in instead.',
    INVALID_PASSWORD: 'Invalid email or password.',
    EMAIL_NOT_FOUND: 'No account found with this email address.',
    USER_DISABLED: 'This account is disabled. Contact support.',
    TOO_MANY_ATTEMPTS_TRY_LATER: 'Too many attempts. Please try again later.',
    OPERATION_NOT_ALLOWED: 'This sign-in method is not enabled. Contact support.',
    CREDENTIAL_TOO_OLD_LOGIN_AGAIN: 'Please sign in again and retry.',
    TOKEN_EXPIRED: 'Your session expired. Please sign in again.',
    INVALID_ID_TOKEN: 'Your session is invalid. Please sign in again.',
    CONFIGURATION_NOT_FOUND: 'Firebase authentication is not configured. Contact support.',
    NETWORK_REQUEST_FAILED: 'Network error. Please check your internet connection.',
    WEAK_PASSWORD: 'Password is too weak. Use at least 6 characters.',
    MISSING_PASSWORD: 'Please enter your password.',
    MISSING_EMAIL: 'Please enter your email address.',
    INVALID_EMAIL: 'Please enter a valid email address.',
    INVALID_LOGIN_CREDENTIALS: 'Invalid email or password.',
    USER_TOKEN_EXPIRED: 'Your session expired. Please sign in again.',
    REQUIRES_RECENT_LOGIN: 'For security, please sign in again and retry.',
    INVALID_OOB_CODE: 'This verification link is invalid or expired.',
    EXPIRED_OOB_CODE: 'This verification link is expired. Request a new one.',
    auth_email_already_in_use: 'This email is already registered. Please sign in instead.',
    auth_invalid_email: 'Please enter a valid email address.',
    auth_operation_not_allowed: 'This sign-in method is not enabled. Contact support.',
    auth_weak_password: 'Password is too weak. Use at least 6 characters.',
    auth_user_disabled: 'This account is disabled. Contact support.',
    auth_user_not_found: 'No account found with this email address.',
    auth_wrong_password: 'Invalid email or password.',
    auth_invalid_credential: 'Invalid email or password.',
    auth_invalid_login_credentials: 'Invalid email or password.',
    auth_too_many_requests: 'Too many attempts. Please try again later.',
    auth_network_request_failed: 'Network error. Please check your internet connection.',
    auth_requires_recent_login: 'For security, please sign in again and retry.',
    auth_id_token_expired: 'Your session expired. Please sign in again.',
    auth_invalid_id_token: 'Your session is invalid. Please sign in again.',
  },
  hi: {
    EMAIL_EXISTS: 'Yah email pahle se registered hai. Kripya sign in karein.',
    INVALID_PASSWORD: 'Email ya password galat hai.',
    EMAIL_NOT_FOUND: 'Is email se koi account nahi mila.',
    USER_DISABLED: 'Yah account disable hai. Support se sampark karein.',
    TOO_MANY_ATTEMPTS_TRY_LATER: 'Bahut zyada attempts hue. Kripya baad mein koshish karein.',
    OPERATION_NOT_ALLOWED: 'Yah sign-in method enabled nahi hai. Support se sampark karein.',
    CREDENTIAL_TOO_OLD_LOGIN_AGAIN: 'Kripya dobara sign in karke phir se koshish karein.',
    TOKEN_EXPIRED: 'Aapka session expire ho gaya. Kripya dobara sign in karein.',
    INVALID_ID_TOKEN: 'Aapka session invalid hai. Kripya dobara sign in karein.',
    CONFIGURATION_NOT_FOUND: 'Firebase authentication configure nahi hai. Support se sampark karein.',
    NETWORK_REQUEST_FAILED: 'Network error. Kripya internet connection check karein.',
    WEAK_PASSWORD: 'Password kamzor hai. Kam se kam 6 characters use karein.',
    MISSING_PASSWORD: 'Kripya password darj karein.',
    MISSING_EMAIL: 'Kripya email address darj karein.',
    INVALID_EMAIL: 'Kripya valid email address darj karein.',
    INVALID_LOGIN_CREDENTIALS: 'Email ya password galat hai.',
    USER_TOKEN_EXPIRED: 'Aapka session expire ho gaya. Kripya dobara sign in karein.',
    REQUIRES_RECENT_LOGIN: 'Security ke liye kripya dobara sign in karke phir koshish karein.',
    INVALID_OOB_CODE: 'Yah verification link invalid ya expire hai.',
    EXPIRED_OOB_CODE: 'Yah verification link expire ho chuka hai. Naya link maangein.',
    auth_email_already_in_use: 'Yah email pahle se registered hai. Kripya sign in karein.',
    auth_invalid_email: 'Kripya valid email address darj karein.',
    auth_operation_not_allowed: 'Yah sign-in method enabled nahi hai. Support se sampark karein.',
    auth_weak_password: 'Password kamzor hai. Kam se kam 6 characters use karein.',
    auth_user_disabled: 'Yah account disable hai. Support se sampark karein.',
    auth_user_not_found: 'Is email se koi account nahi mila.',
    auth_wrong_password: 'Email ya password galat hai.',
    auth_invalid_credential: 'Email ya password galat hai.',
    auth_invalid_login_credentials: 'Email ya password galat hai.',
    auth_too_many_requests: 'Bahut zyada attempts hue. Kripya baad mein koshish karein.',
    auth_network_request_failed: 'Network error. Kripya internet connection check karein.',
    auth_requires_recent_login: 'Security ke liye kripya dobara sign in karke phir koshish karein.',
    auth_id_token_expired: 'Aapka session expire ho gaya. Kripya dobara sign in karein.',
    auth_invalid_id_token: 'Aapka session invalid hai. Kripya dobara sign in karein.',
  },
};

const FALLBACK_MESSAGES: Record<SupportedLocale, string> = {
  en: 'Something went wrong. Please try again.',
  hi: 'Kuch galat ho gaya. Kripya phir se koshish karein.',
};

function normalizeLocale(value: string | undefined | null): SupportedLocale {
  const locale = (value || '').trim().toLowerCase();
  if (!locale) return 'en';
  if (locale.startsWith('hi')) return 'hi';
  return 'en';
}

function resolveInitialLocale(): SupportedLocale {
  const envLocale = normalizeLocale(process.env.NEXT_PUBLIC_APP_LOCALE || process.env.VITE_APP_LOCALE);
  if (envLocale !== 'en') return envLocale;

  if (typeof window !== 'undefined') {
    const storedLocale = normalizeLocale(window.localStorage.getItem('app_locale'));
    if (storedLocale !== 'en') return storedLocale;
  }

  if (typeof navigator !== 'undefined') {
    return normalizeLocale(navigator.language);
  }

  return 'en';
}

let currentLocale: SupportedLocale = resolveInitialLocale();

export function setAuthMessageLocale(locale: string) {
  currentLocale = normalizeLocale(locale);
  if (typeof window !== 'undefined') {
    window.localStorage.setItem('app_locale', currentLocale);
  }
}

export function getAuthMessageLocale(): SupportedLocale {
  return currentLocale;
}

function prettifyCode(code: string) {
  return code
    .replace(/^auth\//i, 'auth_')
    .replace(/[_-]+/g, ' ')
    .toLowerCase()
    .replace(/^./, (char) => char.toUpperCase());
}

function extractFirebaseCode(input: unknown): string | null {
  if (typeof input === 'string') {
    const trimmed = input.trim();
    if (!trimmed) return null;
    if (/^auth\/[a-z0-9-]+$/i.test(trimmed)) return trimmed;
    if (/^[A-Z0-9_]+$/.test(trimmed)) return trimmed;

    const authMatch = trimmed.match(/auth\/[a-z0-9-]+/i);
    if (authMatch?.[0]) return authMatch[0];

    const upperMatch = trimmed.match(/\b[A-Z][A-Z0-9_]{2,}\b/);
    if (upperMatch?.[0]) return upperMatch[0];
  }

  if (input && typeof input === 'object') {
    const maybeCode = (input as { code?: unknown }).code;
    const maybeMessage = (input as { message?: unknown }).message;
    return extractFirebaseCode(maybeCode) || extractFirebaseCode(maybeMessage) || null;
  }

  return null;
}

function toFriendlyFirebaseMessage(input: unknown, fallback?: string) {
  const code = extractFirebaseCode(input);
  const messages = FIREBASE_ERROR_MESSAGES[currentLocale] || FIREBASE_ERROR_MESSAGES.en;
  const defaultFallback = fallback || FALLBACK_MESSAGES[currentLocale] || FALLBACK_MESSAGES.en;

  if (!code) {
    if (input instanceof Error && input.message) return input.message;
    if (typeof input === 'string' && input.trim()) return input;
    return defaultFallback;
  }

  const normalized = code.replace(/\//g, '_').replace(/-/g, '_');
  return (
    messages[code] ||
    messages[normalized] ||
    messages[normalized.toUpperCase()] ||
    messages[normalized.toLowerCase()] ||
    `${prettifyCode(code)}.`
  );
}

let auth: ReturnType<typeof getAuth> | null = null;

if (isFirebaseClientConfigured) {
  try {
    const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
    auth = getAuth(app);
  } catch (error) {
    console.error('Firebase client initialization failed', error);
  }
} else {
  console.warn(
    'Firebase client config is missing. Set NEXT_PUBLIC_FIREBASE_API_KEY, NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN, NEXT_PUBLIC_FIREBASE_PROJECT_ID, and NEXT_PUBLIC_FIREBASE_APP_ID.'
  );
}

/** Firebase auth instance — may be null when Firebase env vars are missing */
export const firebaseAuth = auth;

function ensureFirebaseAuth() {
  if (!auth) {
    throw new Error('Firebase authentication is not configured. Please set NEXT_PUBLIC_FIREBASE_* environment variables.');
  }
  return auth;
}

async function getAccessToken() {
  if (!auth?.currentUser) return null;
  return auth.currentUser.getIdToken();
}

/** Export for use by apiClient without going through the supabase shim */
export async function getFirebaseIdToken(): Promise<string | null> {
  return getAccessToken();
}

function mapUser(user: FirebaseUser): User {
  return {
    id: user.uid,
    email: user.email,
    user_metadata: {
      full_name: user.displayName,
    },
  };
}

async function mapSession(user: FirebaseUser | null): Promise<Session | null> {
  if (!user) return null;
  return {
    user: mapUser(user),
    access_token: await user.getIdToken(),
  };
}

async function apiRequest<T>(path: string, init: RequestInit = {}): SupaResult<T> {
  try {
    const token = await getAccessToken();
    const headers = new Headers(init.headers || {});

    if (!headers.has('Content-Type') && !(init.body instanceof FormData)) {
      headers.set('Content-Type', 'application/json');
    }

    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }

    const response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers,
    });

    const json = await response.json().catch(() => ({}));

    if (!response.ok || json?.error) {
      const rawError = json?.error?.message || `Request failed with status ${response.status}`;
      return {
        data: null,
        error: { message: toFriendlyFirebaseMessage(rawError, 'Request failed. Please try again.') },
      };
    }

    return { data: (json?.data ?? null) as T, count: json?.count ?? null, error: null };
  } catch (error) {
    return {
      data: null,
      error: { message: toFriendlyFirebaseMessage(error, 'Request failed. Please try again.') },
    };
  }
}

class QueryBuilder<T = any>
  implements PromiseLike<{ data: T | null; error: { message: string } | null; count?: number | null }>
{
  private readonly table: string;
  private action: DbAction = 'select';
  private selectClause = '*';
  private filters: Array<{ field: string; op: DbFilterOp; value: unknown }> = [];
  private orders: Array<{ field: string; ascending?: boolean }> = [];
  private rowLimit?: number;
  private payload?: Record<string, unknown>;
  private values?: Record<string, unknown> | Array<Record<string, unknown>>;
  private options: Record<string, unknown> = {};
  private expect: 'many' | 'single' | 'maybeSingle' = 'many';

  constructor(table: string) {
    this.table = table;
  }

  select(select = '*', options?: { count?: 'exact'; head?: boolean }) {
    if (this.action === 'select') {
      this.action = 'select';
    }
    this.selectClause = select;
    if (options) this.options = { ...this.options, ...options };
    return this;
  }

  insert(values: Record<string, unknown> | Array<Record<string, unknown>>) {
    this.action = 'insert';
    this.values = values;
    return this;
  }

  update(payload: Record<string, unknown>) {
    this.action = 'update';
    this.payload = payload;
    return this;
  }

  delete() {
    this.action = 'delete';
    return this;
  }

  upsert(values: Record<string, unknown> | Array<Record<string, unknown>>, options?: Record<string, unknown>) {
    this.action = 'upsert';
    this.values = values;
    this.options = { ...this.options, ...(options || {}) };
    return this;
  }

  eq(field: string, value: unknown) {
    this.filters.push({ field, op: 'eq', value });
    return this;
  }

  neq(field: string, value: unknown) {
    this.filters.push({ field, op: 'neq', value });
    return this;
  }

  in(field: string, value: unknown[]) {
    this.filters.push({ field, op: 'in', value });
    return this;
  }

  not(field: string, operator: string, value: unknown) {
    if (operator === 'in') {
      const parsed = Array.isArray(value)
        ? value
        : String(value)
            .replace(/^\(/, '')
            .replace(/\)$/, '')
            .split(',')
            .map((entry) => entry.trim())
            .filter(Boolean);
      this.filters.push({ field, op: 'not_in', value: parsed });
      return this;
    }

    if (operator === 'eq') {
      this.filters.push({ field, op: 'neq', value });
      return this;
    }

    return this;
  }

  gt(field: string, value: unknown) {
    this.filters.push({ field, op: 'gt', value });
    return this;
  }

  gte(field: string, value: unknown) {
    this.filters.push({ field, op: 'gte', value });
    return this;
  }

  lt(field: string, value: unknown) {
    this.filters.push({ field, op: 'lt', value });
    return this;
  }

  lte(field: string, value: unknown) {
    this.filters.push({ field, op: 'lte', value });
    return this;
  }

  like(field: string, value: string) {
    this.filters.push({ field, op: 'like', value });
    return this;
  }

  ilike(field: string, value: string) {
    this.filters.push({ field, op: 'ilike', value });
    return this;
  }

  is(field: string, value: unknown) {
    this.filters.push({ field, op: 'is', value });
    return this;
  }

  order(field: string, options?: { ascending?: boolean }) {
    this.orders.push({ field, ascending: options?.ascending });
    return this;
  }

  limit(value: number) {
    this.rowLimit = value;
    return this;
  }

  single() {
    this.expect = 'single';
    return this;
  }

  maybeSingle() {
    this.expect = 'maybeSingle';
    return this;
  }

  async execute() {
    const result = await apiRequest<any>('/api/db/query', {
      method: 'POST',
      body: JSON.stringify({
        table: this.table,
        action: this.action,
        select: this.selectClause,
        filters: this.filters,
        order: this.orders,
        limit: this.rowLimit,
        payload: this.payload,
        values: this.values,
        options: this.options,
      }),
    });

    if (result.error) {
      return { data: null, error: result.error, count: result.count ?? null };
    }

    const rows = Array.isArray(result.data) ? result.data : [];

    if (this.expect === 'single') {
      return { data: rows[0] ?? null, error: rows[0] ? null : { message: 'No rows found' }, count: result.count ?? null };
    }

    if (this.expect === 'maybeSingle') {
      return { data: rows[0] ?? null, error: null, count: result.count ?? null };
    }

    return { data: result.data, error: null, count: result.count ?? null };
  }

  then<TResult1 = { data: T | null; error: { message: string } | null; count?: number | null }, TResult2 = never>(
    onfulfilled?: ((value: { data: T | null; error: { message: string } | null; count?: number | null }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return this.execute().then(onfulfilled || undefined, onrejected || undefined);
  }
}

type RealtimeChannel = {
  on: (_event: string, _filter: unknown, _callback: (...args: any[]) => void) => RealtimeChannel;
  subscribe: (_callback?: (...args: any[]) => void) => RealtimeChannel;
  unsubscribe: () => void;
};

function createChannel(): RealtimeChannel {
  return {
    on() {
      return this;
    },
    subscribe(callback?: (...args: any[]) => void) {
      if (callback) {
        setTimeout(() => callback('SUBSCRIBED'), 0);
      }
      return this;
    },
    unsubscribe() {
      return;
    },
  };
}

export const supabase = {
  from<T = any>(table: string) {
    return new QueryBuilder<T>(table);
  },
  auth: {
    async getSession() {
      if (!auth) return { data: { session: null } };
      const session = await mapSession(auth.currentUser);
      return { data: { session } };
    },
    onAuthStateChange(callback: (event: string, session: Session | null) => void) {
      if (!auth) {
        callback('SIGNED_OUT', null);
        return {
          data: {
            subscription: {
              unsubscribe: () => {},
            },
          },
        };
      }

      const unsubscribe = onIdTokenChanged(auth, async (firebaseUser) => {
        const session = await mapSession(firebaseUser);
        callback(firebaseUser ? 'SIGNED_IN' : 'SIGNED_OUT', session);
      });

      return {
        data: {
          subscription: {
            unsubscribe,
          },
        },
      };
    },
    async signInWithPassword({ email, password }: { email: string; password: string }) {
      try {
        const resolvedAuth = ensureFirebaseAuth();
        const credentials = await signInWithEmailAndPassword(resolvedAuth, email, password);
        if (!credentials.user.emailVerified) {
          await firebaseSignOut(resolvedAuth);
          return {
            data: { user: null, session: null },
            error: {
              message:
                'Email not verified yet. Please check your inbox and click the verification link, or resend the email below.',
            },
          };
        }
        const session = await mapSession(credentials.user);
        return { data: { user: session?.user || null, session }, error: null };
      } catch (error) {
        return { data: { user: null, session: null }, error: { message: toFriendlyFirebaseMessage(error) } };
      }
    },
    async signUp({
      email,
      password,
      options,
    }: {
      email: string;
      password: string;
      options?: { data?: { full_name?: string }; emailRedirectTo?: string };
    }) {
      const continueUrl =
        options?.emailRedirectTo ||
        (typeof window !== 'undefined' ? `${window.location.origin}/auth?verified=true` : `${API_BASE_URL}/auth?verified=true`);

      try {
        const resolvedAuth = ensureFirebaseAuth();
        const credentials = await createUserWithEmailAndPassword(resolvedAuth, email, password);
        if (options?.data?.full_name && credentials.user) {
          await updateProfile(credentials.user, { displayName: options.data.full_name });
        }
        if (credentials.user) {
          await sendEmailVerification(credentials.user, { url: continueUrl });
          // Sign out so user can only access the app after email verification
          await firebaseSignOut(resolvedAuth);
        }
        return { data: { user: mapUser(credentials.user) }, error: null };
      } catch (error) {
        const code = extractFirebaseCode(error);
        const isAlreadyInUse =
          code === 'auth/email-already-in-use' ||
          code === 'EMAIL_EXISTS' ||
          code === 'auth_email_already_in_use';

        if (isAlreadyInUse) {
          try {
            const resolvedAuth = ensureFirebaseAuth();
            const existing = await signInWithEmailAndPassword(resolvedAuth, email, password);

            if (existing.user.emailVerified) {
              await firebaseSignOut(resolvedAuth);
              return {
                data: { user: null },
                error: {
                  message: 'This email is already registered and verified. Please sign in.',
                },
              };
            }

            await firebaseSignOut(resolvedAuth);

            return {
              data: { user: null },
              error: {
                message: 'UNVERIFIED_EMAIL_EXISTS_RESEND_CONFIRM',
              },
            };
          } catch (reSignInError) {
            return {
              data: { user: null },
              error: {
                message: toFriendlyFirebaseMessage(
                  reSignInError,
                  'This email is already registered. Use the correct password to resend verification.',
                ),
              },
            };
          }
        }

        return { data: { user: null }, error: { message: toFriendlyFirebaseMessage(error) } };
      }
    },
    async resend({ email, options }: { email: string; type?: string; options?: { emailRedirectTo?: string } }) {
      try {
        const resolvedAuth = ensureFirebaseAuth();
        const continueUrl =
          options?.emailRedirectTo ||
          (typeof window !== 'undefined' ? `${window.location.origin}/auth?verified=true` : `${API_BASE_URL}/auth?verified=true`);

        // If the user is currently signed in and matches, use client SDK
        if (resolvedAuth.currentUser && resolvedAuth.currentUser.email?.toLowerCase() === email.toLowerCase()) {
          await sendEmailVerification(resolvedAuth.currentUser, { url: continueUrl });
          return { data: { message: 'Verification email sent' }, error: null };
        }

        // Otherwise delegate to backend which uses Firebase Admin to generate the link
        const result = await apiRequest<{ message: string }>('/api/auth/resend-verification', {
          method: 'POST',
          body: JSON.stringify({ email }),
        });
        if (result.error) return { data: null, error: result.error };
        return { data: { message: result.data?.message || 'Verification email sent' }, error: null };
      } catch (error) {
        return { data: null, error: { message: toFriendlyFirebaseMessage(error) } };
      }
    },
    async signOut() {
      const resolvedAuth = ensureFirebaseAuth();
      await firebaseSignOut(resolvedAuth);
      return { error: null };
    },
  },
  functions: {
    invoke<T = any>(name: string, payload?: { body?: unknown; headers?: Record<string, string> }) {
      return apiRequest<T>(`/api/functions/${name}`, {
        method: 'POST',
        headers: payload?.headers,
        body: JSON.stringify(payload || {}),
      });
    },
  },
  rpc<T = any>(name: string, args?: Record<string, unknown>) {
    return apiRequest<T>(`/api/rpc/${name}`, {
      method: 'POST',
      body: JSON.stringify(args || {}),
    });
  },
  storage: {
    from(bucket: string) {
      return {
        async upload(path: string, file: File, options?: { upsert?: boolean }) {
          const form = new FormData();
          form.append('file', file);
          form.append('path', path);
          if (options?.upsert) {
            form.append('upsert', 'true');
          }

          return apiRequest(`/api/storage/${bucket}/upload`, {
            method: 'POST',
            body: form,
          });
        },
        getPublicUrl(path: string) {
          return {
            data: {
              publicUrl: `${API_BASE_URL}/uploads/${bucket}/${path.replace(/^\/+/, '')}`,
            },
          };
        },
        list(prefix = '', options?: { limit?: number }) {
          const params = new URLSearchParams();
          if (prefix) params.set('prefix', prefix);
          if (options?.limit) params.set('limit', String(options.limit));
          return apiRequest(`/api/storage/${bucket}/list?${params.toString()}`, { method: 'GET' });
        },
        createSignedUrl(path: string, _expiresIn: number) {
          return apiRequest(`/api/storage/${bucket}/signed-url`, {
            method: 'POST',
            body: JSON.stringify({ path }),
          });
        },
        remove(paths: string[]) {
          return apiRequest(`/api/storage/${bucket}/remove`, {
            method: 'POST',
            body: JSON.stringify({ paths }),
          });
        },
      };
    },
  },
  channel(_name: string) {
    return createChannel();
  },
  removeChannel(_channel: RealtimeChannel) {
    return Promise.resolve('ok');
  },
};