import { PermissionNew } from '../models/PermissionNew.js';
import { RolePermissionNew } from '../models/RolePermissionNew.js';
import { RoleNew } from '../models/RoleNew.js';

const ROLES_DATA = [
  { code: 'ENTITY_ADMIN', name: 'Entity Admin', roleLevel: 'ORG', description: 'Full system access and control' },
  { code: 'DEALER_ADMIN', name: 'Dealer Admin', roleLevel: 'BUSINESS_UNIT', description: 'Manage dealership operations' },
  { code: 'SALES_ADMIN', name: 'Sales Admin (Branch Manager)', roleLevel: 'LOCATION', description: 'Manage sales team and bookings' },
  { code: 'SALES_PERSON', name: 'Sales Person', roleLevel: 'SELF', description: 'Sales representative' },
  { code: 'GRO', name: 'GRO (Ground Relations Officer)', roleLevel: 'SELF', description: 'Customer relations and handover' },
  { code: 'SECURITY', name: 'Security', roleLevel: 'SELF', description: 'Vehicle security and check-in' },
] as const;

const PERMISSIONS_DATA = [
  { code: 'organization.view', name: 'View Organizations', module: 'organization' },
  { code: 'organization.create', name: 'Create Organization', module: 'organization' },
  { code: 'organization.update', name: 'Update Organization', module: 'organization' },
  { code: 'organization.delete', name: 'Delete Organization', module: 'organization' },
  { code: 'business_unit.view', name: 'View Business Units', module: 'business_unit' },
  { code: 'business_unit.create', name: 'Create Business Unit', module: 'business_unit' },
  { code: 'business_unit.update', name: 'Update Business Unit', module: 'business_unit' },
  { code: 'business_unit.delete', name: 'Delete Business Unit', module: 'business_unit' },
  { code: 'brand.view', name: 'View Brands', module: 'brand' },
  { code: 'brand.create', name: 'Create Brand', module: 'brand' },
  { code: 'brand.update', name: 'Update Brand', module: 'brand' },
  { code: 'sales_office.view', name: 'View Sales Offices', module: 'sales_office' },
  { code: 'sales_office.create', name: 'Create Sales Office', module: 'sales_office' },
  { code: 'sales_office.update', name: 'Update Sales Office', module: 'sales_office' },
  { code: 'plant.view', name: 'View Plants', module: 'plant' },
  { code: 'plant.create', name: 'Create Plant', module: 'plant' },
  { code: 'plant.update', name: 'Update Plant', module: 'plant' },
  { code: 'location.view', name: 'View Locations', module: 'location' },
  { code: 'location.create', name: 'Create Location', module: 'location' },
  { code: 'location.update', name: 'Update Location', module: 'location' },
  { code: 'vehicle.view', name: 'View Vehicles', module: 'vehicle' },
  { code: 'vehicle.create', name: 'Create Vehicle', module: 'vehicle' },
  { code: 'vehicle.update', name: 'Update Vehicle', module: 'vehicle' },
  { code: 'vehicle.delete', name: 'Delete Vehicle', module: 'vehicle' },
  { code: 'lead.view', name: 'View Leads', module: 'lead' },
  { code: 'lead.create', name: 'Create Lead', module: 'lead' },
  { code: 'lead.assign', name: 'Assign Lead', module: 'lead' },
  { code: 'lead.update', name: 'Update Lead', module: 'lead' },
  { code: 'test_drive.view', name: 'View Test Drives', module: 'test_drive' },
  { code: 'test_drive.create', name: 'Create Test Drive', module: 'test_drive' },
  { code: 'test_drive.assign', name: 'Assign Test Drive', module: 'test_drive' },
  { code: 'test_drive.update', name: 'Update Test Drive', module: 'test_drive' },
  { code: 'user.view', name: 'View Users', module: 'user' },
  { code: 'user.create', name: 'Create User', module: 'user' },
  { code: 'user.assign_role', name: 'Assign Role', module: 'user' },
  { code: 'report.view', name: 'View Reports', module: 'report' },
  { code: 'price.view', name: 'View Prices', module: 'price' },
  { code: 'price.update', name: 'Update Prices', module: 'price' },
  { code: 'inventory.view', name: 'View Inventory', module: 'inventory' },
  { code: 'inventory.update', name: 'Update Inventory', module: 'inventory' },
] as const;

const ROLE_PERMISSIONS: Record<string, string[]> = {
  SUPER_ADMIN: [
    'organization.view', 'organization.create', 'organization.update', 'organization.delete',
    'business_unit.view', 'business_unit.create', 'business_unit.update', 'business_unit.delete',
    'brand.view', 'brand.create', 'brand.update',
    'sales_office.view', 'sales_office.create', 'sales_office.update',
    'plant.view', 'plant.create', 'plant.update',
    'location.view', 'location.create', 'location.update',
    'vehicle.view', 'vehicle.create', 'vehicle.update', 'vehicle.delete',
    'lead.view', 'lead.create', 'lead.assign', 'lead.update',
    'test_drive.view', 'test_drive.create', 'test_drive.assign', 'test_drive.update',
    'user.view', 'user.create', 'user.assign_role',
    'report.view', 'price.view', 'price.update', 'inventory.view', 'inventory.update',
  ],
  DEALER_ADMIN: [
    'organization.view', 'organization.update',
    'business_unit.view', 'business_unit.create', 'business_unit.update', 'brand.view',
    'sales_office.view', 'sales_office.create', 'sales_office.update',
    'plant.view', 'plant.create', 'plant.update',
    'location.view', 'location.create', 'location.update',
    'vehicle.view', 'vehicle.create', 'vehicle.update',
    'lead.view', 'lead.create', 'lead.assign', 'lead.update',
    'test_drive.view', 'test_drive.create', 'test_drive.assign', 'test_drive.update',
    'user.view', 'user.assign_role',
    'report.view', 'price.view', 'inventory.view',
  ],
  SALES_ADMIN: [
    'vehicle.view', 'vehicle.create', 'vehicle.update',
    'lead.view', 'lead.create', 'lead.assign', 'lead.update',
    'test_drive.view', 'test_drive.create', 'test_drive.assign', 'test_drive.update',
    'user.view', 'report.view', 'inventory.view',
  ],
  SALES_PERSON: [
    'vehicle.view', 'lead.view', 'lead.create', 'test_drive.view', 'test_drive.create', 'report.view',
  ],
  GRO: [
    'vehicle.view', 'test_drive.view', 'test_drive.update', 'report.view',
  ],
  SECURITY: [
    'test_drive.view', 'report.view',
  ],
};

let ensureHierarchyRoleCatalogPromise: Promise<void> | null = null;

async function ensureHierarchyRoleCatalogInternal() {
  const permissionIdsByCode = new Map<string, string>();

  for (const permissionData of PERMISSIONS_DATA) {
    const permission = await PermissionNew.findOneAndUpdate(
      { code: permissionData.code },
      { $set: permissionData },
      { upsert: true, new: true },
    ).lean();
    if (permission?._id) {
      permissionIdsByCode.set(permissionData.code, String(permission._id));
    }
  }

  for (const roleData of ROLES_DATA) {
    const role = await RoleNew.findOneAndUpdate(
      { code: roleData.code },
      { $set: { ...roleData, isActive: true } },
      { upsert: true, new: true },
    ).lean();

    if (!role?._id) {
      continue;
    }

    for (const permissionCode of ROLE_PERMISSIONS[roleData.code] || []) {
      const permissionId = permissionIdsByCode.get(permissionCode);
      if (!permissionId) {
        continue;
      }

      await RolePermissionNew.findOneAndUpdate(
        { roleId: role._id, permissionId },
        { $setOnInsert: { roleId: role._id, permissionId } },
        { upsert: true, new: true },
      );
    }
  }
}

export async function ensureHierarchyRoleCatalogSeeded() {
  if (!ensureHierarchyRoleCatalogPromise) {
    ensureHierarchyRoleCatalogPromise = ensureHierarchyRoleCatalogInternal().finally(() => {
      ensureHierarchyRoleCatalogPromise = null;
    });
  }

  await ensureHierarchyRoleCatalogPromise;
}