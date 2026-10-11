import { getFirebaseIdToken } from '@/integrations/supabase/client';
import { SELECTED_LOCATION_KEY } from '@/hooks/useDealerContext';
import { getApiBaseUrl } from '@/lib/getApiBaseUrl';

type DbFilterOp = 'eq' | 'neq' | 'in' | 'not_in' | 'gt' | 'gte' | 'lt' | 'lte' | 'like' | 'ilike' | 'is';

type DbQueryPayload = {
  table: string;
  action: 'select' | 'insert' | 'update' | 'delete' | 'upsert';
  select?: string;
  filters?: Array<{ field: string; op: DbFilterOp; value: unknown }>;
  order?: Array<{ field: string; ascending?: boolean }>;
  limit?: number;
  payload?: Record<string, unknown>;
  values?: Record<string, unknown> | Array<Record<string, unknown>>;
  options?: Record<string, unknown>;
};

const API_BASE_URL = getApiBaseUrl();
const AUTH_TEARDOWN_KEY = 'auth_teardown_in_progress';
const AUTH_TEARDOWN_TTL_MS = 5000;

function isAuthTeardownInProgress() {
  if (typeof window === 'undefined') return false;
  try {
    const raw = window.sessionStorage.getItem(AUTH_TEARDOWN_KEY);
    if (!raw) return false;

    const startedAt = Number(raw);
    if (!Number.isFinite(startedAt)) {
      window.sessionStorage.removeItem(AUTH_TEARDOWN_KEY);
      return false;
    }

    const isActive = Date.now() - startedAt < AUTH_TEARDOWN_TTL_MS;
    if (!isActive) {
      window.sessionStorage.removeItem(AUTH_TEARDOWN_KEY);
    }
    return isActive;
  } catch {
    return false;
  }
}

export function markAuthTeardownInProgress() {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(AUTH_TEARDOWN_KEY, String(Date.now()));
  } catch {
    // ignore storage failures
  }
}

export function clearAuthTeardownInProgress() {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(AUTH_TEARDOWN_KEY);
  } catch {
    // ignore storage failures
  }
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = payload + '='.repeat((4 - (payload.length % 4)) % 4);
    const json = atob(padded);
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

async function buildHeaders(init?: HeadersInit, includeJson = true) {
  const headers = new Headers(init || {});
  if (includeJson && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const token = await getFirebaseIdToken();
  let isSuperAdmin = false;
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
    const claims = decodeJwtPayload(token);
    const role = String(claims?.role || '').trim().toLowerCase();
    isSuperAdmin = role === 'superadmin' || role === 'super_admin';
  }

  // Forward selected location scope only for non-superadmin users.
  try {
    const selectedLocId = localStorage.getItem(SELECTED_LOCATION_KEY);
    if (selectedLocId && !isSuperAdmin) headers.set('X-Selected-Location-Id', selectedLocId);
  } catch { /* storage unavailable */ }

  return headers;
}

async function request<T>(path: string, init: RequestInit = {}) {
  const headers = await buildHeaders(init.headers, !(init.body instanceof FormData));
  const response = await fetch(`${API_BASE_URL}${path}`, { ...init, headers });
  const raw = await response.text();
  let json: any = {};
  if (raw) {
    try {
      json = JSON.parse(raw);
    } catch {
      json = {};
    }
  }

  const bodyError = json?.error;
  const messageFromBody =
    (typeof bodyError === 'string' ? bodyError : bodyError?.message) ||
    json?.message ||
    (raw && !raw.trim().startsWith('<') ? raw.trim() : '');

  if ((!response.ok || json?.error) && isAuthTeardownInProgress()) {
    const normalized = String(messageFromBody || '').toLowerCase();
    const isAuthError = response.status === 401 || response.status === 403 || normalized.includes('unauthorized') || normalized.includes('forbidden');
    if (isAuthError) {
      return null as T;
    }
  }

  if (!response.ok || json?.error) {
    throw new Error(messageFromBody || `Request failed (${response.status})`);
  }

  return (json?.data ?? null) as T;
}

export async function apiGet<T>(path: string) {
  return request<T>(path, { method: 'GET' });
}

export async function apiPost<T>(path: string, payload: Record<string, unknown>) {
  return request<T>(path, { method: 'POST', body: JSON.stringify(payload) });
}

export async function apiPatch<T>(path: string, payload: Record<string, unknown>) {
  return request<T>(path, { method: 'PATCH', body: JSON.stringify(payload) });
}

export async function apiPut<T>(path: string, payload: Record<string, unknown>) {
  return request<T>(path, { method: 'PUT', body: JSON.stringify(payload) });
}

export async function apiDelete<T>(path: string) {
  return request<T>(path, { method: 'DELETE' });
}

export async function apiDbQuery<T>(payload: DbQueryPayload) {
  return request<T>('/api/db/query', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function apiInvokeFunction<T>(name: string, body: Record<string, unknown> = {}) {
  return request<T>(`/api/functions/${encodeURIComponent(name)}`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function apiStorageUpload(
  bucket: string,
  path: string,
  file: File,
  options?: { upsert?: boolean }
) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('path', path);
  if (options?.upsert) {
    formData.append('upsert', 'true');
  }

  return request<any>(`/api/storage/${encodeURIComponent(bucket)}/upload`, {
    method: 'POST',
    body: formData,
  });
}

export async function apiStoragePublicUrl(bucket: string, path: string) {
  const data = await request<{ publicUrl: string }>(`/api/storage/${encodeURIComponent(bucket)}/public-url`, {
    method: 'POST',
    body: JSON.stringify({ path }),
  });

  return data?.publicUrl || '';
}

export async function apiStorageSignedUrl(bucket: string, path: string, expiresIn = 300) {
  const data = await request<{ signedUrl: string }>(`/api/storage/${encodeURIComponent(bucket)}/signed-url`, {
    method: 'POST',
    body: JSON.stringify({ path, expiresIn }),
  });

  return data?.signedUrl || '';
}

export async function apiStorageList(bucket: string, prefix: string, limit = 100) {
  const query = new URLSearchParams({ prefix, limit: String(limit) }).toString();
  return request<any[]>(`/api/storage/${encodeURIComponent(bucket)}/list?${query}`, {
    method: 'GET',
  });
}

export async function apiStorageRemove(bucket: string, paths: string[]) {
  return request<any>(`/api/storage/${encodeURIComponent(bucket)}/remove`, {
    method: 'POST',
    body: JSON.stringify({ paths }),
  });
}

export async function apiRpc<T>(name: string, payload: Record<string, unknown> = {}) {
  return request<T>(`/api/rpc/${encodeURIComponent(name)}`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
