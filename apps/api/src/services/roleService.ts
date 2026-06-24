export type AppUserRole =
  | 'superadmin'
  | 'super_admin'
  | 'entity_admin'
  | 'dealer_admin'
  | 'brand_admin'
  | 'sales_admin'
  | 'brand_branch_admin'
  | 'gro'
  | 'sales'
  | 'sales_person'
  | 'entity'
  | 'security'
  | 'reporting'
  | string;

const LEGACY_ROLE_MAP: Record<string, string> = {
  super_admin: 'superadmin',
  entity_admin: 'entity_admin',
  entity: 'entity_admin',
  brand_admin: 'dealer_admin',
  branch_admin: 'sales_admin',
  branchadmin: 'sales_admin',
  brandbranchadmin: 'sales_admin',
  brandbranch_admin: 'sales_admin',
  salesperson: 'sales_person',
  sales: 'sales_person',
};

export function normalizeAppRole(input: unknown): string {
  const raw = String(input ?? '').trim().toLowerCase();
  if (!raw) return '';
  const normalized = raw.replace(/[-\s]+/g, '_');
  return LEGACY_ROLE_MAP[normalized] || normalized;
}

export function isSuperAdminRole(role: unknown): boolean {
  const normalized = normalizeAppRole(role);
  return normalized === 'superadmin';
}

export function isDealerAdminRole(role: unknown): boolean {
  const normalized = normalizeAppRole(role);
  return normalized === 'dealer_admin';
}

export function isSalesAdminRole(role: unknown): boolean {
  const normalized = normalizeAppRole(role);
  return normalized === 'sales_admin';
}

export function isBrandBranchAdminRole(role: unknown): boolean {
  return normalizeAppRole(role) === 'sales_admin';
}
export function isEntityAdminRole(role: unknown): boolean {
  return normalizeAppRole(role) === 'entity_admin';
}


export function isLocationScopedRole(role: unknown): boolean {
  const normalized = normalizeAppRole(role);
  return new Set(['gro', 'sales_person', 'sales_admin', 'security']).has(normalized);
}
