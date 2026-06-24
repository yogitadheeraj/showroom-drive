import {
  APP_ROLE_BADGE_CLASS,
  APP_ROLE_LABELS,
  APP_ROLE_VALUES,
  AppRole,
  CANONICAL_APP_ROLE_VALUES,
  CanonicalAppRole,
  LEGACY_ROLE_ALIASES,
} from '@/constants/roles';

export const isAppRole = (value: unknown): value is AppRole => {
  return typeof value === 'string' && APP_ROLE_VALUES.includes(value as AppRole);
};

export const isCanonicalAppRole = (value: unknown): value is CanonicalAppRole => {
  return typeof value === 'string' && CANONICAL_APP_ROLE_VALUES.includes(value as CanonicalAppRole);
};

export const normalizeAppRole = (role: string | null | undefined): CanonicalAppRole | null => {
  if (!role) return null;
  if (isCanonicalAppRole(role)) return role;
  if (isAppRole(role) && LEGACY_ROLE_ALIASES[role]) return LEGACY_ROLE_ALIASES[role] ?? null;
  if (role === 'super_admin') return 'superadmin';
  return null;
};

export const getAppRoleLabel = (role: string | null | undefined): string => {
  const normalizedRole = normalizeAppRole(role);
  if (normalizedRole) return APP_ROLE_LABELS[normalizedRole];
  return isAppRole(role) ? APP_ROLE_LABELS[role] : role || 'Unknown';
};

export const getAppRoleBadgeClass = (role: string | null | undefined): string => {
  const normalizedRole = normalizeAppRole(role);
  if (normalizedRole) return APP_ROLE_BADGE_CLASS[normalizedRole];
  return isAppRole(role) ? APP_ROLE_BADGE_CLASS[role] : 'bg-primary text-black';
};