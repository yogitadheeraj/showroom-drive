import mongoose from 'mongoose';
import { Organization } from '../models/Organization.js';
import { BusinessUnit } from '../models/BrandNew.js';
import { BrandNew } from '../models/BrandNewModel.js';
import { BusinessUnitBrand } from '../models/BusinessUnitBrand.js';
import { SalesOffice } from '../models/SalesOffice.js';
import { Plant } from '../models/Plant.js';
import { LocationNew } from '../models/LocationNew.js';
import { RoleNew } from '../models/RoleNew.js';
import { PermissionNew } from '../models/PermissionNew.js';
import { RolePermissionNew } from '../models/RolePermissionNew.js';
import { VehicleNew } from '../models/VehicleNew.js';

const ROLES_DATA = [
  { code: 'ENTITY_ADMIN', name: 'Entity Admin', roleLevel: 'ORG', description: 'Full system access and control' },
  { code: 'DEALER_ADMIN', name: 'Dealer Admin', roleLevel: 'BUSINESS_UNIT', description: 'Manage dealership operations' },
  { code: 'SALES_ADMIN', name: 'Sales Admin (Branch Manager)', roleLevel: 'LOCATION', description: 'Manage sales team and bookings' },
  { code: 'SALES_PERSON', name: 'Sales Person', roleLevel: 'SELF', description: 'Sales representative' },
  { code: 'GRO', name: 'GRO (Ground Relations Officer)', roleLevel: 'SELF', description: 'Customer relations and handover' },
  { code: 'SECURITY', name: 'Security', roleLevel: 'SELF', description: 'Vehicle security and check-in' },
];

const PERMISSIONS_DATA = [
  // Organization
  { code: 'organization.view', name: 'View Organizations', module: 'organization' },
  { code: 'organization.create', name: 'Create Organization', module: 'organization' },
  { code: 'organization.update', name: 'Update Organization', module: 'organization' },
  { code: 'organization.delete', name: 'Delete Organization', module: 'organization' },

  // Business Unit
  { code: 'business_unit.view', name: 'View Business Units', module: 'business_unit' },
  { code: 'business_unit.create', name: 'Create Business Unit', module: 'business_unit' },
  { code: 'business_unit.update', name: 'Update Business Unit', module: 'business_unit' },
  { code: 'business_unit.delete', name: 'Delete Business Unit', module: 'business_unit' },

  // Brand
  { code: 'brand.view', name: 'View Brands', module: 'brand' },
  { code: 'brand.create', name: 'Create Brand', module: 'brand' },
  { code: 'brand.update', name: 'Update Brand', module: 'brand' },

  // Sales Office
  { code: 'sales_office.view', name: 'View Sales Offices', module: 'sales_office' },
  { code: 'sales_office.create', name: 'Create Sales Office', module: 'sales_office' },
  { code: 'sales_office.update', name: 'Update Sales Office', module: 'sales_office' },

  // Plant
  { code: 'plant.view', name: 'View Plants', module: 'plant' },
  { code: 'plant.create', name: 'Create Plant', module: 'plant' },
  { code: 'plant.update', name: 'Update Plant', module: 'plant' },

  // Location
  { code: 'location.view', name: 'View Locations', module: 'location' },
  { code: 'location.create', name: 'Create Location', module: 'location' },
  { code: 'location.update', name: 'Update Location', module: 'location' },

  // Vehicle
  { code: 'vehicle.view', name: 'View Vehicles', module: 'vehicle' },
  { code: 'vehicle.create', name: 'Create Vehicle', module: 'vehicle' },
  { code: 'vehicle.update', name: 'Update Vehicle', module: 'vehicle' },
  { code: 'vehicle.delete', name: 'Delete Vehicle', module: 'vehicle' },

  // Lead
  { code: 'lead.view', name: 'View Leads', module: 'lead' },
  { code: 'lead.create', name: 'Create Lead', module: 'lead' },
  { code: 'lead.assign', name: 'Assign Lead', module: 'lead' },
  { code: 'lead.update', name: 'Update Lead', module: 'lead' },

  // Test Drive
  { code: 'test_drive.view', name: 'View Test Drives', module: 'test_drive' },
  { code: 'test_drive.create', name: 'Create Test Drive', module: 'test_drive' },
  { code: 'test_drive.assign', name: 'Assign Test Drive', module: 'test_drive' },
  { code: 'test_drive.update', name: 'Update Test Drive', module: 'test_drive' },

  // User & Role
  { code: 'user.view', name: 'View Users', module: 'user' },
  { code: 'user.create', name: 'Create User', module: 'user' },
  { code: 'user.assign_role', name: 'Assign Role', module: 'user' },

  // Report
  { code: 'report.view', name: 'View Reports', module: 'report' },
  { code: 'price.view', name: 'View Prices', module: 'price' },
  { code: 'price.update', name: 'Update Prices', module: 'price' },
  { code: 'inventory.view', name: 'View Inventory', module: 'inventory' },
  { code: 'inventory.update', name: 'Update Inventory', module: 'inventory' },
];

const ROLE_PERMISSIONS = {
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

async function seedRolesAndPermissions() {
  console.log('Seeding roles and permissions...');

  // Clear existing
  await RoleNew.deleteMany({});
  await PermissionNew.deleteMany({});
  await RolePermissionNew.deleteMany({});

  // Create permissions
  const createdPermissions = await PermissionNew.insertMany(PERMISSIONS_DATA);
  const permissionMap: Record<string, any> = {};
  createdPermissions.forEach((p: any) => {
    permissionMap[p.code] = p._id;
  });

  // Create roles and assign permissions
  for (const roleData of ROLES_DATA) {
    const role = await RoleNew.create(roleData);
    const permissionCodes = ROLE_PERMISSIONS[roleData.code as keyof typeof ROLE_PERMISSIONS] || [];

    const rolePermissions = permissionCodes.map((code: string) => ({
      roleId: role._id,
      permissionId: permissionMap[code],
    }));

    if (rolePermissions.length > 0) {
      await RolePermissionNew.insertMany(rolePermissions);
    }
  }

  console.log('✓ Roles and permissions seeded');
}

async function seedALFuttaimData() {
  console.log('Seeding AL Futtaim organization structure...');

  // Create organization
  const org = await Organization.create({
    name: 'AL Futtaim',
    code: 'ALF',
    type: 'GROUP',
    country: 'AE',
  });
  console.log('✓ Organization created:', org._id);

  // Create brands
  const bydBrand = await BrandNew.create({ name: 'BYD', code: 'BYD' });
  const toyotaBrand = await BrandNew.create({ name: 'Toyota', code: 'TOY' });
  const lexusBrand = await BrandNew.create({ name: 'Lexus', code: 'LEX' });
  const hondaBrand = await BrandNew.create({ name: 'Honda', code: 'HON' });
  const nissanBrand = await BrandNew.create({ name: 'Nissan', code: 'NIS' });
  console.log('✓ Brands created');

  // Create business units
  const bydBU = await BusinessUnit.create({
    orgId: org._id,
    name: 'BYD',
    code: 'BYD',
    businessType: 'BRAND_DEALER',
  });

  const toyotaBU = await BusinessUnit.create({
    orgId: org._id,
    name: 'Toyota',
    code: 'TOY',
    businessType: 'BRAND_DEALER',
  });

  const lexusBU = await BusinessUnit.create({
    orgId: org._id,
    name: 'Lexus',
    code: 'LEX',
    businessType: 'BRAND_DEALER',
  });

  const automallBU = await BusinessUnit.create({
    orgId: org._id,
    name: 'Automall',
    code: 'ATM',
    businessType: 'USED_CAR_MARKETPLACE',
  });
  console.log('✓ Business units created');

  // Create business unit brand mappings
  await BusinessUnitBrand.create({ orgId: org._id, businessUnitId: bydBU._id, brandId: bydBrand._id, allowedConditions: ['NEW', 'USED'] });
  await BusinessUnitBrand.create({ orgId: org._id, businessUnitId: toyotaBU._id, brandId: toyotaBrand._id, allowedConditions: ['NEW', 'USED'] });
  await BusinessUnitBrand.create({ orgId: org._id, businessUnitId: lexusBU._id, brandId: lexusBrand._id, allowedConditions: ['NEW', 'USED'] });
  
  // Automall can have multiple brands - USED only
  await BusinessUnitBrand.create({ orgId: org._id, businessUnitId: automallBU._id, brandId: toyotaBrand._id, allowedConditions: ['USED'] });
  await BusinessUnitBrand.create({ orgId: org._id, businessUnitId: automallBU._id, brandId: lexusBrand._id, allowedConditions: ['USED'] });
  await BusinessUnitBrand.create({ orgId: org._id, businessUnitId: automallBU._id, brandId: bydBrand._id, allowedConditions: ['USED'] });
  await BusinessUnitBrand.create({ orgId: org._id, businessUnitId: automallBU._id, brandId: hondaBrand._id, allowedConditions: ['USED'] });
  await BusinessUnitBrand.create({ orgId: org._id, businessUnitId: automallBU._id, brandId: nissanBrand._id, allowedConditions: ['USED'] });
  console.log('✓ Business unit brand mappings created');

  // Create sales offices
  const bydSalesDXB = await SalesOffice.create({
    orgId: org._id,
    businessUnitId: bydBU._id,
    name: 'BYD Dubai Sales Office',
    externalSalesOfficeId: 'Y2E1',
    country: 'AE',
    city: 'Dubai',
  });

  const automallSalesDXB = await SalesOffice.create({
    orgId: org._id,
    businessUnitId: automallBU._id,
    name: 'Automall Dubai Sales Office',
    externalSalesOfficeId: 'ATM001',
    country: 'AE',
    city: 'Dubai',
  });
  console.log('✓ Sales offices created');

  // Create plants
  const bydPlantDFC = await Plant.create({
    orgId: org._id,
    businessUnitId: bydBU._id,
    salesOfficeId: bydSalesDXB._id,
    name: 'BYD Dubai Festival City',
    externalPlantId: 'YE21',
    plantType: 'SHOWROOM',
    country: 'AE',
    city: 'Dubai',
  });

  const automallPlant = await Plant.create({
    orgId: org._id,
    businessUnitId: automallBU._id,
    salesOfficeId: automallSalesDXB._id,
    name: 'Automall Used Car Center',
    plantType: 'STOCKYARD',
    country: 'AE',
    city: 'Dubai',
  });
  console.log('✓ Plants created');

  // Create locations
  const testDriveLoc = await LocationNew.create({
    orgId: org._id,
    businessUnitId: bydBU._id,
    salesOfficeId: bydSalesDXB._id,
    plantId: bydPlantDFC._id,
    name: 'DFC Test Drive Location',
    externalLocationId: 'YMP2',
    locationType: 'TEST_DRIVE_AREA',
    address: 'Dubai Festival City, Dubai, AE',
    latitude: 25.1972,
    longitude: 55.2744,
  });

  const automallLoc = await LocationNew.create({
    orgId: org._id,
    businessUnitId: automallBU._id,
    salesOfficeId: automallSalesDXB._id,
    plantId: automallPlant._id,
    name: 'Automall Used Car Location',
    locationType: 'STOCK_AREA',
    address: 'Dubai Auto Market, Dubai, AE',
  });
  console.log('✓ Locations created');

  // Create sample vehicles
  const bydVehicle = await VehicleNew.create({
    orgId: org._id,
    businessUnitId: bydBU._id,
    brandId: bydBrand._id,
    salesOfficeId: bydSalesDXB._id,
    plantId: bydPlantDFC._id,
    locationId: testDriveLoc._id,
    model: 'Yuan Plus',
    variant: 'EV',
    year: 2024,
    color: 'White',
    condition: 'NEW',
    stockType: 'NEW_STOCK',
    status: 'AVAILABLE',
    price: 99000,
    currency: 'AED',
  });

  const toyotaUsedVehicle = await VehicleNew.create({
    orgId: org._id,
    businessUnitId: automallBU._id,
    brandId: toyotaBrand._id,
    salesOfficeId: automallSalesDXB._id,
    plantId: automallPlant._id,
    locationId: automallLoc._id,
    model: 'Camry',
    variant: '2.5L',
    year: 2020,
    color: 'Silver',
    condition: 'USED',
    stockType: 'PRE_OWNED',
    status: 'AVAILABLE',
    price: 45000,
    currency: 'AED',
    mileage: 65000,
  });
  console.log('✓ Sample vehicles created');

  console.log('\n✓ AL Futtaim data structure seeded successfully!');
  console.log('\nStructure created:');
  console.log('  Organization: AL Futtaim');
  console.log('    ├── BYD (Brand Dealer) - Dubai');
  console.log('    │   └── Plant: BYD DFC - Location: Test Drive');
  console.log('    ├── Toyota (Brand Dealer) - Dubai');
  console.log('    ├── Lexus (Brand Dealer) - Dubai');
  console.log('    └── Automall (Used Car Marketplace) - Dubai');
  console.log('        └── Plant: Used Car Center - Location: Stock Area');
}

export async function seedDatabase() {
  try {
    console.log('Starting database seeding...');
    await seedRolesAndPermissions();
    await seedALFuttaimData();
    console.log('\n✓ Database seeded successfully!');
  } catch (error) {
    console.error('Seeding error:', error);
    process.exit(1);
  }
}
