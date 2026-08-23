export const APP_ROLE = {
  SUPERADMIN: 'superadmin',
  DEALER_ADMIN: 'dealer_admin',
  SERVICE_EXPERT: 'service_expert',
  GRO: 'gro',
  SALES: 'sales',
  SECURITY: 'security',
} as const;

export type AppRole = (typeof APP_ROLE)[keyof typeof APP_ROLE];