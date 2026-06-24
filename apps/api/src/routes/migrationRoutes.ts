/**
 * Migration API Endpoints
 * Handles data migration from legacy system to new hierarchy system
 */

import { Router, Request, Response } from 'express';
import { requireAuth, requireSuperAdmin } from '../middleware/auth.js';
import { MigrationService, MigrationHelper } from '../utils/migrationHelper.js';

export const migrationRouter = Router();

/**
 * POST /api/v1/migrate/locations
 * Migrate all legacy locations to new LocationNew structure
 */
migrationRouter.post('/migrate/locations', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const { defaultBusinessUnitId, defaultSalesOfficeId } = req.body;

    if (!defaultBusinessUnitId || !defaultSalesOfficeId) {
      return res.status(400).json({ error: 'defaultBusinessUnitId and defaultSalesOfficeId are required' });
    }

    const result = await MigrationService.migrateLocations(defaultBusinessUnitId, defaultSalesOfficeId);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/v1/migrate/vehicles
 * Migrate all legacy vehicles to new VehicleNew structure
 */
migrationRouter.post('/migrate/vehicles', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const { defaultBusinessUnitId, defaultBrandId } = req.body;

    if (!defaultBusinessUnitId || !defaultBrandId) {
      return res.status(400).json({ error: 'defaultBusinessUnitId and defaultBrandId are required' });
    }

    const result = await MigrationService.migrateVehicles(defaultBusinessUnitId, defaultBrandId);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/v1/migrate/test-drives
 * Migrate all legacy test drives to new TestDriveNew structure
 */
migrationRouter.post('/migrate/test-drives', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const { defaultBusinessUnitId, defaultBrandId } = req.body;

    if (!defaultBusinessUnitId || !defaultBrandId) {
      return res.status(400).json({ error: 'defaultBusinessUnitId and defaultBrandId are required' });
    }

    const result = await MigrationService.migrateTestDrives(defaultBusinessUnitId, defaultBrandId);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/v1/migrate/run-all
 * Run complete migration for all entities
 */
migrationRouter.post(
  '/migrate/run-all',
  requireAuth,
  requireSuperAdmin,
  async (req: Request, res: Response) => {
    try {
      const { defaultBusinessUnitId, defaultSalesOfficeId, defaultBrandId } = req.body;

      if (!defaultBusinessUnitId || !defaultSalesOfficeId || !defaultBrandId) {
        return res.status(400).json({
          error: 'defaultBusinessUnitId, defaultSalesOfficeId, and defaultBrandId are required',
        });
      }

      const result = await MigrationService.runCompleteMigration(
        defaultBusinessUnitId,
        defaultSalesOfficeId,
        defaultBrandId
      );

      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

/**
 * GET /api/v1/migrate/verify
 * Validate migration by comparing counts
 */
migrationRouter.get('/migrate/verify', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const validation = await MigrationService.validateMigration();
    res.json(validation);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default migrationRouter;
