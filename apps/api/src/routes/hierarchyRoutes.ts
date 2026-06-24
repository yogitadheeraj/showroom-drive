import express, { Router, Request, Response } from 'express';
import {
  attachAuthContext,
  buildScopeFilter,
  requireAuth,
  requirePermission,
  requireRole,
} from '../middleware/authContextMiddleware.js';
import { validateRequest, createOrganizationSchema, createBusinessUnitSchema, createSalesOfficeSchema, createPlantSchema, createLocationSchema, createVehicleSchema, assignUserRoleSchema } from '../middleware/validationMiddleware.js';
import * as services from '../services/hierarchyService.js';

const router = Router();

// Apply auth middleware to all routes
router.use(attachAuthContext);

/**
 * ==================== Organization Routes ====================
 */

// GET /api/v1/organizations
router.get('/organizations', requireAuth, requirePermission('organization.view'), async (req: Request, res: Response) => {
  try {
    const scopeFilter = buildScopeFilter(req.auth);
    // Organization documents use _id, while scoped hierarchy entities use orgId.
    // Translate even when orgId is null so DEALER_ADMIN with no assignment sees nothing.
    if ('orgId' in scopeFilter) {
      scopeFilter._id = scopeFilter.orgId;
      delete scopeFilter.orgId;
    }
    const organizations = await services.OrganizationService.findAll(scopeFilter);
    res.json({data: organizations, error: null});
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// POST /api/v1/organizations
router.post('/organizations', requireAuth, requirePermission('organization.create'), validateRequest(createOrganizationSchema), async (req: Request, res: Response) => {
  try {
    const org = await services.OrganizationService.create(req.body);
    res.status(201).json(org);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

// GET /api/v1/organizations/:id
router.get('/organizations/:id', requireAuth, requirePermission('organization.view'), async (req: Request, res: Response) => {
  try {
    const org = await services.OrganizationService.findById(req.params.id);
    if (!org) return res.status(404).json({ error: 'Organization not found' });
    res.json({data: org, error: null});
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * ==================== Business Unit Routes ====================
 */

// GET /api/v1/business-units
router.get('/business-units', requireAuth, requirePermission('business_unit.view'), async (req: Request, res: Response) => {
  try {
    const scopeFilter = buildScopeFilter(req.auth);
    const units = await services.BusinessUnitService.findAll(scopeFilter);
    res.json({data: units, error: null});
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// POST /api/v1/business-units
router.post('/business-units', requireAuth, requirePermission('business_unit.create'), validateRequest(createBusinessUnitSchema), async (req: Request, res: Response) => {
  try {
    const unit = await services.BusinessUnitService.create(req.body);
    res.status(201).json(unit);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

// GET /api/v1/business-units/:id
router.get('/business-units/:id', requireAuth, requirePermission('business_unit.view'), async (req: Request, res: Response) => {
  try {
    const unit = await services.BusinessUnitService.findById(req.params.id);
    if (!unit) return res.status(404).json({ error: 'Business unit not found' });
    res.json({ data: unit, error: null });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * ==================== Brand Routes ====================
 */

// GET /api/v1/brands
router.get('/brands', requireAuth, requirePermission('brand.view'), async (req: Request, res: Response) => {
  try {
    const brands = await services.BrandService.findAll();
    res.json({  data: brands, error: null });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * ==================== Business Unit Brand Routes ====================
 */

// GET /api/v1/business-unit-brands?businessUnitId=...
router.get('/business-unit-brands', requireAuth, requirePermission('business_unit.view'), async (req: Request, res: Response) => {
  try {
    const { businessUnitId } = req.query;
    if (!businessUnitId) return res.status(400).json({ error: 'businessUnitId required' });
    const mappings = await services.BusinessUnitBrandService.findByBusinessUnit(businessUnitId as string);
    res.json({ data: mappings, error: null });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// POST /api/v1/business-unit-brands
router.post('/business-unit-brands', requireAuth, requirePermission('business_unit.update'), async (req: Request, res: Response) => {
  try {
    const mapping = await services.BusinessUnitBrandService.create(req.body);
    res.status(201).json(mapping);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

/**
 * ==================== Sales Office Routes ====================
 */

// GET /api/v1/sales-offices
router.get('/sales-offices', requireAuth, requirePermission('sales_office.view'), async (req: Request, res: Response) => {
  try {
    const scopeFilter = buildScopeFilter(req.auth);
    const offices = await services.SalesOfficeService.findAll(scopeFilter);
    res.json({ data: offices, error: null });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// POST /api/v1/sales-offices
router.post('/sales-offices', requireAuth, requirePermission('sales_office.create'), validateRequest(createSalesOfficeSchema), async (req: Request, res: Response) => {
  try {
    const office = await services.SalesOfficeService.create(req.body);
    res.status(201).json(office);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

// PATCH /api/v1/sales-offices/:id
router.patch('/sales-offices/:id', requireAuth, requirePermission('sales_office.update'), async (req: Request, res: Response) => {
  try {
    const office = await services.SalesOfficeService.update(req.params.id, req.body);
    if (!office) return res.status(404).json({ error: 'Sales office not found' });
    res.json({ data: office, error: null });
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

// GET /api/v1/sales-offices/:id
router.get('/sales-offices/:id', requireAuth, requirePermission('sales_office.view'), async (req: Request, res: Response) => {
  try {
    const office = await services.SalesOfficeService.findById(req.params.id);
    if (!office) return res.status(404).json({ error: 'Sales office not found' });
    res.json({ data: office, error: null });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * ==================== Plant Routes ====================
 */

// GET /api/v1/plants
router.get('/plants', requireAuth, requirePermission('plant.view'), async (req: Request, res: Response) => {
  try {
    const scopeFilter = buildScopeFilter(req.auth);
    const plants = await services.PlantService.findAll(scopeFilter);
    res.json({ data: plants, error: null });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// POST /api/v1/plants
router.post('/plants', requireAuth, requirePermission('plant.create'), validateRequest(createPlantSchema), async (req: Request, res: Response) => {
  try {
    const plant = await services.PlantService.create(req.body);
    res.status(201).json({ data: plant, error: null });
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

// PATCH /api/v1/plants/:id
router.patch('/plants/:id', requireAuth, requirePermission('plant.update'), async (req: Request, res: Response) => {
  try {
    const plant = await services.PlantService.update(req.params.id, req.body);
    if (!plant) return res.status(404).json({ error: 'Plant not found' });
    res.json({ data: plant, error: null });
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

// GET /api/v1/plants/:id
router.get('/plants/:id', requireAuth, requirePermission('plant.view'), async (req: Request, res: Response) => {
  try {
    const plant = await services.PlantService.findById(req.params.id);
    if (!plant) return res.status(404).json({ error: 'Plant not found' });
    res.json({ data: plant, error: null });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * ==================== Location Routes ====================
 */

// GET /api/v1/locations
router.get('/locations', requireAuth, requirePermission('location.view'), async (req: Request, res: Response) => {
  try {
    const scopeFilter = buildScopeFilter(req.auth);
    const {
      organization_id,
      orgId,
      business_unit_id,
      businessUnitId,
      sales_office_id,
      salesOfficeId,
      plant_id,
      plantId,
      ids,
      is_active,
    } = req.query as Record<string, string | undefined>;

    // Translate scope fields to LocationNew schema.
    if (scopeFilter.locationId) {
      scopeFilter._id = scopeFilter.locationId;
      delete scopeFilter.locationId;
    }

    // Allow explicit query filters, but never widen auth scope.
    const requestedOrgId = organization_id || orgId;
    if (!scopeFilter.orgId && requestedOrgId) {
      scopeFilter.orgId = requestedOrgId;
    }

    const requestedBusinessUnitId = business_unit_id || businessUnitId;
    if (!scopeFilter.businessUnitId && requestedBusinessUnitId) {
      scopeFilter.businessUnitId = requestedBusinessUnitId;
    }

    const requestedSalesOfficeId = sales_office_id || salesOfficeId;
    if (!scopeFilter.salesOfficeId && requestedSalesOfficeId) {
      scopeFilter.salesOfficeId = requestedSalesOfficeId;
    }

    const requestedPlantId = plant_id || plantId;
    if (!scopeFilter.plantId && requestedPlantId) {
      scopeFilter.plantId = requestedPlantId;
    }

    if (!scopeFilter._id && typeof ids === 'string' && ids.trim()) {
      const parsedIds = ids
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean);
      if (parsedIds.length === 1) {
        scopeFilter._id = parsedIds[0];
      } else if (parsedIds.length > 1) {
        scopeFilter._id = { $in: parsedIds };
      }
    }

    if (typeof is_active === 'string') {
      scopeFilter.isActive = is_active === 'true';
    }

    const locations = await services.LocationService.findAll(scopeFilter);
    const normalized = (locations || []).map((loc: any) => ({
      ...loc,
      id: String(loc._id || loc.id || ''),
    }));
    res.json({ data: normalized, error: null });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// POST /api/v1/locations
router.post('/locations', requireAuth, requirePermission('location.create'), validateRequest(createLocationSchema), async (req: Request, res: Response) => {
  try {
    const location = await services.LocationService.create(req.body);
    const normalized = location ? { ...location, id: String(location._id || location.id || '') } : null;
    res.status(201).json({ data: normalized, error: null });
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

// PATCH /api/v1/locations/:id
router.patch('/locations/:id', requireAuth, requirePermission('location.update'), async (req: Request, res: Response) => {
  try {
    const location = await services.LocationService.update(req.params.id, req.body);
    if (!location) return res.status(404).json({ error: 'Location not found' });
    const normalized = { ...location, id: String(location._id || location.id || '') };
    res.json({ data: normalized, error: null });
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

// GET /api/v1/locations/:id
router.get('/locations/:id', requireAuth, requirePermission('location.view'), async (req: Request, res: Response) => {
  try {
    const location = await services.LocationService.findById(req.params.id);
    if (!location) return res.status(404).json({ error: 'Location not found' });
    const normalized = { ...location, id: String(location._id || location.id || '') };
    res.json({data: normalized, error: null});
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * ==================== Vehicle Routes ====================
 */

// GET /api/v1/vehicles
router.get('/vehicles', requireAuth, requirePermission('vehicle.view'), async (req: Request, res: Response) => {
  try {
    const scopeFilter = buildScopeFilter(req.auth);
    const { status, condition } = req.query;
    const filters = { ...scopeFilter };
    if (status) filters.status = status;
    if (condition) filters.condition = condition;
    const vehicles = await services.VehicleService.findAll(filters);
    res.json({ data: vehicles, error: null });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// POST /api/v1/vehicles
router.post('/vehicles', requireAuth, requirePermission('vehicle.create'), validateRequest(createVehicleSchema), async (req: Request, res: Response) => {
  try {
    const vehicle = await services.VehicleService.create(req.body);
    res.status(201).json(vehicle);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

// GET /api/v1/vehicles/:id
router.get('/vehicles/:id', requireAuth, requirePermission('vehicle.view'), async (req: Request, res: Response) => {
  try {
    const vehicle = await services.VehicleService.findById(req.params.id);
    if (!vehicle) return res.status(404).json({ error: 'Vehicle not found' });
    res.json({ data: vehicle, error: null });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * ==================== Lead Routes ====================
 */

// GET /api/v1/leads
router.get('/leads', requireAuth, requirePermission('lead.view'), async (req: Request, res: Response) => {
  try {
    const scopeFilter = buildScopeFilter(req.auth);
    const leads = await services.LeadService.findAll(scopeFilter);
    res.json({ data: leads, error: null });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// POST /api/v1/leads
router.post('/leads', requireAuth, requirePermission('lead.create'), async (req: Request, res: Response) => {
  try {
    const lead = await services.LeadService.create(req.body);
    res.status(201).json({ data: lead, error: null });
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

// POST /api/v1/leads/:id/assign
router.post('/leads/:id/assign', requireAuth, requirePermission('lead.assign'), async (req: Request, res: Response) => {
  try {
    const { salesPersonId } = req.body;
    const lead = await services.LeadService.assign(req.params.id, salesPersonId);
    res.json({ data: lead, error: null });
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

/**
 * ==================== Test Drive Routes ====================
 */

// GET /api/v1/test-drives
router.get('/test-drives', requireAuth, requirePermission('test_drive.view'), async (req: Request, res: Response) => {
  try {
    const scopeFilter = buildScopeFilter(req.auth);
    const testDrives = await services.TestDriveService.findAll(scopeFilter);
    res.json({ data: testDrives, error: null });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// POST /api/v1/test-drives
router.post('/test-drives', requireAuth, requirePermission('test_drive.create'), async (req: Request, res: Response) => {
  try {
    const testDrive = await services.TestDriveService.create(req.body);
    res.status(201).json(testDrive);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

// POST /api/v1/test-drives/:id/assign
router.post('/test-drives/:id/assign', requireAuth, requirePermission('test_drive.assign'), async (req: Request, res: Response) => {
  try {
    const { salesPersonId, groId, securityId } = req.body;
    const testDrive = await services.TestDriveService.assign(req.params.id, salesPersonId, groId, securityId);
    res.json({ data: testDrive, error: null });
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

/**
 * ==================== Role Catalog Routes ====================
 */

// GET /api/v1/roles — list all active hierarchy roles (with their permissions)
router.get('/roles', requireAuth, async (req: Request, res: Response) => {
  try {
    const roles = await services.RoleService.findAll({ isActive: true });
    res.json({ data: roles, error: null });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// GET /api/v1/roles/:id
router.get('/roles/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const role = await services.RoleService.findById(req.params.id);
    if (!role) return res.status(404).json({ error: 'Role not found' });
    res.json({ data: role, error: null });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * ==================== User Role Assignment Routes ====================
 */

// POST /api/v1/user-role-assignments
router.post('/user-role-assignments', requireAuth, requirePermission('user.assign_role'), validateRequest(assignUserRoleSchema), async (req: Request, res: Response) => {
  try {
    const assignment = await services.UserRoleAssignmentService.assign(req.body);
    res.status(201).json({ data: assignment, error: null });
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

// GET /api/v1/user-role-assignments
router.get('/user-role-assignments', requireAuth, requirePermission('user.view'), async (req: Request, res: Response) => {
  try {
    const { orgId, businessUnitId, salesOfficeId, plantId, locationId, userId } = req.query;
    const filters: Record<string, unknown> = {};
    if (typeof orgId === 'string' && orgId) filters.orgId = orgId;
    if (typeof businessUnitId === 'string' && businessUnitId) filters.businessUnitId = businessUnitId;
    if (typeof salesOfficeId === 'string' && salesOfficeId) filters.salesOfficeId = salesOfficeId;
    if (typeof plantId === 'string' && plantId) filters.plantId = plantId;
    if (typeof locationId === 'string' && locationId) filters.locationId = locationId;
    if (typeof userId === 'string' && userId) filters.userId = userId;

    const assignments = await services.UserRoleAssignmentService.findAll(filters);
    res.json({ data: assignments, error: null });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// GET /api/v1/users/:userId/roles
router.get('/users/:userId/roles', requireAuth, async (req: Request, res: Response) => {
  try {
    const assignments = await services.UserRoleAssignmentService.findByUser(req.params.userId);
    res.json({ data: assignments, error: null });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * ==================== Auth Context Endpoint ====================
 */

// GET /api/v1/auth/me
router.get('/auth/me', async (req: Request, res: Response) => {
  if (!req.auth) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  res.json({ data: req.auth, error: null });
});

export default router;
