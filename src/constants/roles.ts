export const APP_ROLE = {
  SUPERADMIN: 'superadmin',
  DEALER_ADMIN: 'dealer_admin',
  SALES_ADMIN: 'sales_admin',
  GRO: 'gro',
  SALES: 'sales',
  SECURITY: 'security',
} as const;

export type AppRole = (typeof APP_ROLE)[keyof typeof APP_ROLE];

export const APP_ROLE_VALUES: AppRole[] = Object.values(APP_ROLE);
export const DEFAULT_APP_ROLE: AppRole = APP_ROLE.SALES;

export const APP_ROLE_LABELS: Record<AppRole, string> = {
  [APP_ROLE.SUPERADMIN]: 'Super Admin',
  [APP_ROLE.DEALER_ADMIN]: 'Dealer Admin',
  [APP_ROLE.SALES_ADMIN]: 'Branch Admin',
  [APP_ROLE.GRO]: 'GRO',
  [APP_ROLE.SALES]: 'Sales',
  [APP_ROLE.SECURITY]: 'Security',
};

export const APP_ROLE_BADGE_CLASS: Record<AppRole, string> = {
  [APP_ROLE.SUPERADMIN]: 'bg-destructive/10 text-destructive',
  [APP_ROLE.DEALER_ADMIN]: 'bg-secondary/10 text-secondary-foreground',
  [APP_ROLE.SALES_ADMIN]: 'bg-purple-100 text-purple-700',
  [APP_ROLE.GRO]: 'bg-primary/10 text-primary',
  [APP_ROLE.SALES]: 'bg-info/10 text-info',
  [APP_ROLE.SECURITY]: 'bg-warning/10 text-warning',
};

export const STAFF_ROLE_OPTIONS = [
  { value: APP_ROLE.DEALER_ADMIN, label: 'Dealer Admin' },
  { value: APP_ROLE.SALES_ADMIN, label: 'Branch Admin (Sales Admin)' },
  { value: APP_ROLE.GRO, label: 'GRO' },
  { value: APP_ROLE.SALES, label: 'Sales Person' },
  { value: APP_ROLE.SECURITY, label: 'Security' },
] as const;

// Roles that Dealer Admin can assign (cannot assign Superadmin)
export const DEALER_ASSIGNABLE_ROLES = [
  { value: APP_ROLE.SALES_ADMIN, label: 'Branch Admin (Sales Admin)' },
  { value: APP_ROLE.GRO, label: 'GRO' },
  { value: APP_ROLE.SALES, label: 'Sales Person' },
  { value: APP_ROLE.SECURITY, label: 'Security' },
] as const;

export const ROUTE_ALLOWED_ROLES = {
  WALKIN: [APP_ROLE.GRO, APP_ROLE.DEALER_ADMIN, APP_ROLE.SALES_ADMIN, APP_ROLE.SALES],
  ENQUIRIES: [APP_ROLE.SUPERADMIN, APP_ROLE.DEALER_ADMIN, APP_ROLE.SALES_ADMIN, APP_ROLE.GRO, APP_ROLE.SALES],
  LOCATIONS: [APP_ROLE.SUPERADMIN, APP_ROLE.DEALER_ADMIN, APP_ROLE.SALES_ADMIN],
  VEHICLES: [APP_ROLE.SUPERADMIN, APP_ROLE.DEALER_ADMIN, APP_ROLE.SALES_ADMIN, APP_ROLE.GRO],
  USERS: [APP_ROLE.SUPERADMIN, APP_ROLE.DEALER_ADMIN, APP_ROLE.SALES_ADMIN],
  DATA_CENTER: [APP_ROLE.SUPERADMIN, APP_ROLE.DEALER_ADMIN, APP_ROLE.SALES_ADMIN],
  SETTINGS: [APP_ROLE.DEALER_ADMIN],
  REPORTS_MONITORING: [APP_ROLE.SUPERADMIN, APP_ROLE.DEALER_ADMIN, APP_ROLE.SALES_ADMIN, APP_ROLE.GRO],
} as const;