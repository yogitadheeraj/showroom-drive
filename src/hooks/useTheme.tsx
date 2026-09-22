import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { apiPatch } from '@/lib/apiClient';
import { useAuthOptional } from './useAuth';

export type Theme = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

interface ThemeContextValue {
  theme: Theme;
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);
const STORAGE_KEY = 'autoadvant-theme';

const isThemeValue = (value: unknown): value is Theme =>
  value === 'light' || value === 'dark' || value === 'system';

const getStoredTheme = (): Theme | null => {
  if (typeof window === 'undefined') return null;
  const value = localStorage.getItem(STORAGE_KEY);
  return isThemeValue(value) ? value : null;
};

const getSystemTheme = (): ResolvedTheme =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';

const applyTheme = (resolved: ResolvedTheme) => {
  const root = document.documentElement;
  root.classList.toggle('dark', resolved === 'dark');
  root.style.colorScheme = resolved;
};

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const auth = useAuthOptional();
  const [theme, setThemeState] = useState<Theme>('light');
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>('light');
  const hydratedProfileForUserRef = useRef<string | null>(null);
  const lastSyncedThemeRef = useRef<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    setThemeState(getStoredTheme() || 'light');
  }, []);

  useEffect(() => {
    if (!auth?.user?.id) {
      hydratedProfileForUserRef.current = null;
      return;
    }
    if (auth.loading) return;
    if (hydratedProfileForUserRef.current === auth.user.id) return;

    const storedTheme = getStoredTheme();
    if (storedTheme) {
      setThemeState(storedTheme);
      hydratedProfileForUserRef.current = auth.user.id;
      return;
    }

    const profileTheme = auth.profile?.preferences?.theme;
    if (isThemeValue(profileTheme)) {
      setThemeState(profileTheme);
    }

    hydratedProfileForUserRef.current = auth.user.id;
  }, [auth?.loading, auth?.profile?.preferences?.theme, auth?.user?.id]);

  useEffect(() => {
    const resolved = theme === 'system' ? getSystemTheme() : (theme as ResolvedTheme);
    setResolvedTheme(resolved);
    applyTheme(resolved);
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, theme);
    }
  }, [theme]);

  useEffect(() => {
    const profileId = auth?.profile?.id;
    if (!profileId || !auth?.user?.id) {
      lastSyncedThemeRef.current = null;
      return;
    }

    const profileTheme = auth.profile?.preferences?.theme;
    if (profileTheme === theme) {
      lastSyncedThemeRef.current = `${profileId}:${theme}`;
      return;
    }

    const syncKey = `${profileId}:${theme}`;
    if (lastSyncedThemeRef.current === syncKey) return;
    lastSyncedThemeRef.current = syncKey;

    void apiPatch(`/api/profiles/${profileId}`, {
      preferences: {
        ...(auth.profile?.preferences || {}),
        theme,
      },
    }).catch(() => {
      // Best effort: localStorage remains source of truth on failure.
    });
  }, [auth?.profile?.id, auth?.profile?.preferences, auth?.user?.id, theme]);

  useEffect(() => {
    if (theme !== 'system') return;
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => {
      const resolved = getSystemTheme();
      setResolvedTheme(resolved);
      applyTheme(resolved);
    };
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, [theme]);

  const setTheme = (next: Theme) => setThemeState(next);
  const toggleTheme = () => setThemeState(resolvedTheme === 'dark' ? 'light' : 'dark');

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
};
