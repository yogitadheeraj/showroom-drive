export function getReadableErrorMessage(error: unknown, fallback = 'Something went wrong. Please try again.') {
  const raw = (() => {
    if (!error) return '';
    if (typeof error === 'string') return error;
    if (error instanceof Error) return error.message || '';
    if (typeof error === 'object' && error !== null) {
      const candidate = (error as { message?: unknown }).message;
      if (typeof candidate === 'string') return candidate;
    }
    return '';
  })().trim();

  if (!raw) return fallback;

  // API fallback messages are less helpful than business-rule errors from backend.
  if (/^Request failed \(\d+\)$/i.test(raw)) {
    return fallback;
  }

  return raw;
}
