import { supabase } from '@/integrations/supabase/client';

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

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

async function buildHeaders(init?: HeadersInit, includeJson = true) {
  const headers = new Headers(init || {});
  if (includeJson && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  return headers;
}

async function request<T>(path: string, init: RequestInit = {}) {
  const headers = await buildHeaders(init.headers, !(init.body instanceof FormData));
  const response = await fetch(`${API_BASE_URL}${path}`, { ...init, headers });
  const json = await response.json().catch(() => ({}));

  if (!response.ok || json?.error) {
    throw new Error(json?.error?.message || `Request failed (${response.status})`);
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
