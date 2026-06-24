export const APP_ROLE = {
  SUPERADMIN: 'superadmin',
  ENTITY: 'entity',
  BRAND_ADMIN: 'brand_admin',
  BRAND_BRANCH_ADMIN: 'brand_branch_admin',
  DEALER_ADMIN: 'dealer_admin',
  SALES_ADMIN: 'sales_admin',
  SALES_PERSON: 'sales_person',
  GRO: 'gro',
  SECURITY: 'security',
} as const;

export type AppRole = (typeof APP_ROLE)[keyof typeof APP_ROLE];