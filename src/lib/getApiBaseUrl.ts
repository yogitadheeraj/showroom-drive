const LOCALHOST_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);

const normalize = (value?: string | null) => (value || '').trim().replace(/\/$/, '');

export function getApiBaseUrl() {
  const envBase = normalize(
    process.env.NEXT_PUBLIC_API_BASE_URL ||
      process.env.NEXT_PUBLIC_API_URL
  );

  if (typeof window === 'undefined') {
    return envBase || 'http://localhost:4000';
  }

  const currentHost = window.location.hostname;
  const isLocalFrontend = LOCALHOST_HOSTS.has(currentHost);
  const envLooksLocal = /localhost|127\.0\.0\.1|\[::1\]/i.test(envBase);

  if (envBase && !(envLooksLocal && !isLocalFrontend)) {
    return envBase;
  }

  return window.location.origin;
}
