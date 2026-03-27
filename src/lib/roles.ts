import {
  APP_ROLE_BADGE_CLASS,
  APP_ROLE_LABELS,
  APP_ROLE_VALUES,
  AppRole,
} from '@/constants/roles';

export const isAppRole = (value: unknown): value is AppRole => {
  return typeof value === 'string' && APP_ROLE_VALUES.includes(value as AppRole);
};

export const getAppRoleLabel = (role: string | null | undefined): string => {
  return isAppRole(role) ? APP_ROLE_LABELS[role] : role || 'Unknown';
};

export const getAppRoleBadgeClass = (role: string | null | undefined): string => {
  return isAppRole(role) ? APP_ROLE_BADGE_CLASS[role] : 'bg-muted text-muted-foreground';
};