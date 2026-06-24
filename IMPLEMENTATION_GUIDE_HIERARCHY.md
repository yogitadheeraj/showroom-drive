# Organizational Hierarchy Backend - Implementation Guide

## Overview
This is a complete fresh implementation of a scalable automotive backend with a hierarchical organizational structure supporting AL Futtaim, BYD, Toyota, Lexus, and Automall.

## Architecture Components

### 1. **Mongoose Models (14 Collections)**
Located in `apps/api/src/models/`:

- **Organization.ts** - Top-level entity (AL Futtaim)
- **BrandNew.ts** - Business units (BYD, Toyota, Lexus, Automall)
- **BrandNewModel.ts** - Brand definitions (BYD, Toyota, Lexus, Honda, Nissan)
- **BusinessUnitBrand.ts** - Brand-Business Unit mapping (validates which brands/conditions allowed)
- **SalesOffice.ts** - Regional sales offices with auto-generated codes (SO-DXB-BYD-001)
- **Plant.ts** - Showrooms, stockyards, workshops (PL-DXB-BYD-001)
- **LocationNew.ts** - Specific locations within plants (LOC-DXB-BYD-001)
- **VehicleNew.ts** - Vehicle inventory (NEW/USED with business unit filtering)
- **LeadNew.ts** - Customer leads
- **TestDriveNew.ts** - Test drive bookings
- **RoleNew.ts** - 11 role types with hierarchy levels
- **PermissionNew.ts** - Module-based permissions (vehicle.view, test_drive.create, etc.)
- **RolePermissionNew.ts** - Role-Permission associations
- **UserRoleAssignmentNew.ts** - User-Role assignments with scope (orgId, businessUnitId, etc.)

### 2. **Service Layer**
File: `apps/api/src/services/hierarchyService.ts`

Contains 14 services with CRUD operations:
- OrganizationService
- BusinessUnitService
- BrandService
- BusinessUnitBrandService (validates brand access)
- SalesOfficeService
- PlantService
- LocationService
- VehicleService (validates brand/condition combinations)
- LeadService
- TestDriveService
- RoleService
- PermissionService
- RolePermissionService
- UserRoleAssignmentService

### 3. **Middleware**

#### authContextMiddleware.ts
- `attachAuthContext()` - Extracts user roles, permissions, and scope from DB
- `buildScopeFilter()` - Creates database filters based on user hierarchy
- `requireAuth()` - Ensures user is authenticated
- `requirePermission()` - Checks specific permission
- `requireRole()` - Checks role type

#### validationMiddleware.ts
- `validateRequest()` - Zod-based schema validation
- Predefined schemas for all entity types
- Schema files: Organization, BusinessUnit, SalesOffice, Plant, Location, Vehicle, etc.

### 4. **Utilities**

#### codeGeneratorHelper.ts
Auto-generates human-readable codes:
```
SO-DXB-BYD-001    # Sales Office
PL-DXB-BYD-001    # Plant
LOC-DXB-BYD-001   # Location
ALF-BYD-2024-0001 # Vehicle
```

### 5. **API Routes**
File: `apps/api/src/routes/hierarchyRoutes.ts`

**Organization**: GET, POST /organizations/:id
**Business Units**: GET, POST /business-units/:id
**Brands**: GET /brands
**Brand Mappings**: GET, POST /business-unit-brands
**Sales Offices**: GET, POST /sales-offices/:id
**Plants**: GET, POST /plants/:id
**Locations**: GET, POST /locations/:id
**Vehicles**: GET, POST /vehicles/:id (with condition validation)
**Leads**: GET, POST /leads, POST /leads/:id/assign
**Test Drives**: GET, POST /test-drives, POST /test-drives/:id/assign
**User Roles**: POST /user-role-assignments, GET /users/:userId/roles
**Auth**: GET /auth/me (returns user context with permissions & scope)

### 6. **Seed Data**
File: `apps/api/src/scripts/seedHierarchyData.ts`

Creates:
- 11 roles (Super Admin, Entity Admin, Business Unit Admin, Sales Person, GRO, Security, etc.)
- 30+ permissions across 10 modules
- AL Futtaim organization structure
- 4 business units (BYD, Toyota, Lexus, Automall)
- 5 brands (BYD, Toyota, Lexus, Honda, Nissan)
- Brand mappings (Automall can have Toyota/Lexus/BYD as USED only)
- Dubai sales offices and plants
- Test drive and stock locations
- Sample vehicles

## Integration Steps

### 1. Register Models
Update `apps/api/src/models/index.ts`:
```typescript
export { Organization } from './Organization.js';
export { BusinessUnit } from './BrandNew.js';
export { BrandNew } from './BrandNewModel.js';
export { BusinessUnitBrand } from './BusinessUnitBrand.js';
export { SalesOffice } from './SalesOffice.js';
export { Plant } from './Plant.js';
export { LocationNew } from './LocationNew.js';
export { VehicleNew } from './VehicleNew.js';
export { LeadNew } from './LeadNew.js';
export { TestDriveNew } from './TestDriveNew.js';
export { RoleNew } from './RoleNew.js';
export { PermissionNew } from './PermissionNew.js';
export { RolePermissionNew } from './RolePermissionNew.js';
export { UserRoleAssignmentNew } from './UserRoleAssignmentNew.js';
```

### 2. Register Routes
In `apps/api/src/routes/index.ts`:
```typescript
import hierarchyRoutes from './hierarchyRoutes.js';

router.use('/api/v1', hierarchyRoutes);
```

### 3. Run Seed Script
```bash
cd apps/api
npx ts-node src/scripts/seedHierarchyData.ts
```

### 4. Test Endpoints
```bash
# Create organization
POST /api/v1/organizations
{
  "name": "AL Futtaim",
  "code": "ALF",
  "type": "GROUP",
  "country": "AE"
}

# Create sales office (auto-generates code)
POST /api/v1/sales-offices
{
  "orgId": "...",
  "businessUnitId": "...",
  "name": "Dubai Sales Office",
  "country": "AE",
  "city": "Dubai"
}
# Returns: { salesOfficeCode: "SO-DXB-BYD-001", ... }

# Create vehicle (validates brand+condition)
POST /api/v1/vehicles
{
  "orgId": "...",
  "businessUnitId": "bu_automall",
  "brandId": "brand_toyota",
  "condition": "USED",  # Allowed
  "stockType": "PRE_OWNED",
  "model": "Camry",
  "year": 2020,
  "price": 45000,
  ...
}

# Assign role to user
POST /api/v1/user-role-assignments
{
  "userId": "user123",
  "roleId": "role_sales_admin",
  "orgId": "org_alf",
  "businessUnitId": "bu_byd",
  "salesOfficeId": "so_dubai",
  "plantId": "plant_dfc",
  "locationId": "loc_test_drive",
  "isPrimary": true
}

# Get auth context
GET /api/v1/auth/me
# Returns:
{
  "user": { "id": "user123" },
  "role": {
    "code": "SALES_ADMIN",
    "name": "Sales Admin",
    "permissions": ["vehicle.view", "lead.view", "test_drive.create", ...]
  },
  "scope": {
    "orgId": "org_alf",
    "businessUnitId": "bu_byd",
    "salesOfficeId": "so_dubai",
    ...
  }
}
```

## Key Features

### 1. **Hierarchical Scope Control**
Every user has a scope defining what they can access:
- **SUPER_ADMIN**: Global access (orgId only)
- **ENTITY_ADMIN**: All business units in entity
- **BUSINESS_UNIT_ADMIN**: Specific business unit + brand
- **SALES_ADMIN**: Specific sales office/plant/location
- **SALES_PERSON**: Single location, only assigned leads/test drives

### 2. **Brand-Business Unit Validation**
```typescript
// BYD can have NEW and USED
await BusinessUnitBrandService.validateBrandAccess(
  'bu_byd', 'brand_byd', 'NEW'  // ✓ Allowed
);

// Automall can have Toyota but USED only
await BusinessUnitBrandService.validateBrandAccess(
  'bu_automall', 'brand_toyota', 'NEW'  // ✗ Error
);
```

### 3. **Auto-Generated Human-Readable Codes**
```
SO-DXB-BYD-001   # City-BusinessUnit-Sequence
PL-DXB-BYD-001
LOC-DXB-BYD-001
ALF-BYD-2024-0001 # For vehicles
```

### 4. **Permission-Based Access Control**
```
# Each role has specific permissions
SALES_ADMIN: vehicle.view, lead.view, lead.create, lead.assign, test_drive.view, test_drive.create

# Routes enforce permissions
router.post('/leads/:id/assign', requirePermission('lead.assign'), ...)
```

### 5. **Role-Specific Filtering**
```typescript
// SALES_PERSON automatically filtered to their assigned test drives
const scopeFilter = buildScopeFilter(authContext);
// For SALES_PERSON: { assignedSalesPersonId: 'user123' }

// GRO filtered to their assigned test drives
// For GRO: { groId: 'user123' }
```

## Data Relationships

```
Organization (AL Futtaim)
  ├── Business Unit (BYD, Toyota, Lexus, Automall)
  │   ├── Brand (BYD, Toyota, Lexus, Honda, Nissan)
  │   │   └── Business Unit Brand (mapping with conditions)
  │   ├── Sales Office (Dubai SO-DXB-BYD-001)
  │   │   └── Plant (DFC Plant PL-DXB-BYD-001)
  │   │       └── Location (Test Drive LOC-DXB-BYD-001)
  │   │           └── Vehicle (BYD Yuan Plus, Toyota Camry)
  │   │               └── Lead
  │   │                   └── Test Drive
  │   └── User Role Assignment
  │       └── Role (with permissions)
```

## Example Workflow

### 1. Create Organization
```
POST /organizations
{ "name": "AL Futtaim", "code": "ALF", ... }
```

### 2. Create Business Units
```
POST /business-units
{ "orgId": "alf_id", "name": "BYD", "code": "BYD", "businessType": "BRAND_DEALER" }
```

### 3. Create Brand & Map to Business Unit
```
POST /business-unit-brands
{
  "orgId": "alf_id",
  "businessUnitId": "bu_byd",
  "brandId": "brand_byd",
  "allowedConditions": ["NEW", "USED"]
}
```

### 4. Create Sales Office (auto-generates code)
```
POST /sales-offices
{ "orgId": "alf_id", "businessUnitId": "bu_byd", "city": "Dubai", ... }
// Returns: salesOfficeCode: "SO-DXB-BYD-001"
```

### 5. Create Plant Under Sales Office
```
POST /plants
{ "salesOfficeId": "so_id", "plantType": "SHOWROOM", ... }
// Returns: plantCode: "PL-DXB-BYD-001"
```

### 6. Create Location Under Plant
```
POST /locations
{ "plantId": "plant_id", "locationType": "TEST_DRIVE_AREA", ... }
// Returns: locationCode: "LOC-DXB-BYD-001"
```

### 7. Add Vehicles
```
POST /vehicles
{
  "businessUnitId": "bu_byd",
  "brandId": "brand_byd",
  "condition": "NEW",  // Validated against BusinessUnitBrand mapping
  ...
}
```

### 8. Assign Roles to Users
```
POST /user-role-assignments
{
  "userId": "sales_person_1",
  "roleId": "role_sales_person",
  "orgId": "alf_id",
  "businessUnitId": "bu_byd",
  "locationId": "loc_test_drive",
  "isPrimary": true
}
```

### 9. User Makes API Call
```
GET /test-drives (with x-user-id header)
// Middleware applies scope filter
// Only returns test drives where assignedSalesPersonId = 'sales_person_1'
```

## Testing

### Create Test User
```bash
# Assign user role with full permissions
POST /user-role-assignments
{
  "userId": "test_user_123",
  "roleId": "entity_admin_role_id",
  "orgId": "alf_org_id",
  "isPrimary": true
}
```

### Test CRUD
```bash
# List all (with scope)
curl -H "x-user-id: test_user_123" GET /api/v1/vehicles

# Create
curl -X POST /api/v1/vehicles \
  -H "Content-Type: application/json" \
  -H "x-user-id: test_user_123" \
  -d { "businessUnitId": "...", "condition": "NEW", ... }

# Get
curl -H "x-user-id: test_user_123" GET /api/v1/vehicles/123

# Update
curl -X PATCH /api/v1/vehicles/123 \
  -H "x-user-id: test_user_123" \
  -d { "status": "SOLD" }
```

## Next Steps

1. **Frontend Integration** - Create React components for hierarchy management
2. **Advanced Features** - Reporting, analytics, audit logging
3. **External System Integration** - SAP, DMS, ERP via external codes
4. **Batch Operations** - Import vehicles, bulk role assignments
5. **Webhooks** - Real-time notifications for test drives, leads

## Database Indexes
All models include proper indexes:
- Unique codes (salesOfficeCode, plantCode, locationCode)
- Foreign key relationships
- Composite indexes for filtered queries
- Sparse indexes for optional external IDs

## Performance Considerations
- Use `.lean()` for read-only queries (no hydration)
- Populate only required fields
- Implement pagination for list endpoints (future enhancement)
- Consider caching role/permission lookups (hourly TTL)
- Add query filtering by date range for test drives and leads
