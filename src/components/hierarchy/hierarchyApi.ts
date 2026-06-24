import { getFirebaseIdToken } from '@/integrations/supabase/client';
import { SELECTED_LOCATION_KEY } from '@/hooks/useDealerContext';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

async function buildHeaders(init?: HeadersInit) {
  const headers = new Headers(init || {});
  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const token = await getFirebaseIdToken();
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  try {
    const selectedLocId = localStorage.getItem(SELECTED_LOCATION_KEY);
    if (selectedLocId) headers.set('X-Selected-Location-Id', selectedLocId);
  } catch {
    // Storage unavailable.
  }

  return headers;
}

async function request<T>(path: string, init: RequestInit = {}) {
  const headers = await buildHeaders(init.headers);
  const response = await fetch(`${API_BASE_URL}${path}`, { ...init, headers });
  const json = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      (json && typeof json === 'object' && 'error' in json && typeof (json as { error?: unknown }).error === 'string'
        ? (json as { error: string }).error
        : null) ||
      (json && typeof json === 'object' && 'error' in json && typeof (json as { error?: { message?: string } }).error?.message === 'string'
        ? (json as { error: { message: string } }).error.message
        : null) ||
      `Request failed (${response.status})`;
    throw new Error(message);
  }

  if (json && typeof json === 'object' && 'data' in json) {
    return (json as { data: T }).data;
  }

  return json as T;
}

export async function hierarchyGet<T>(path: string) {
  return request<T>(path, { method: 'GET' });
}

export async function hierarchyPost<T>(path: string, payload: Record<string, unknown>) {
  return request<T>(path, { method: 'POST', body: JSON.stringify(payload) });
}

export async function hierarchyPatch<T>(path: string, payload: Record<string, unknown>) {
  return request<T>(path, { method: 'PATCH', body: JSON.stringify(payload) });
}

export async function hierarchyDelete<T>(path: string) {
  return request<T>(path, { method: 'DELETE' });
}