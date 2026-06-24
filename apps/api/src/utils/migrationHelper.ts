import mongoose from 'mongoose';

/**
 * Migration Utilities for transitioning from old system to new hierarchy system
 * Provides helpers to map old data structures to new ones
 */

export class MigrationHelper {
  /**
   * Maps old Location (legacy) to new LocationNew structure
   * Assumes a 1:1 mapping to a default business unit
   */
  static mapLegacyLocationToNew(oldLocation: any, defaultBusinessUnitId: string, defaultSalesOfficeId: string) {
    return {
      orgId: defaultBusinessUnitId.split('-')[0], // Extract org from BU ID
      businessUnitId: defaultBusinessUnitId,
      salesOfficeId: defaultSalesOfficeId,
      plantId: oldLocation.plantId, // Must be provided
      name: oldLocation.name,
      locationType: oldLocation.locationType || 'SHOWROOM',
      address: oldLocation.address,
      latitude: oldLocation.latitude,
      longitude: oldLocation.longitude,
      isActive: oldLocation.isActive !== false,
    };
  }

  /**
   * Maps old Vehicle to new VehicleNew structure
   * Assumes vehicle has a default business unit and brand
   */
  static mapLegacyVehicleToNew(oldVehicle: any, defaultBusinessUnitId: string, defaultBrandId: string) {
    return {
      orgId: defaultBusinessUnitId.split('-')[0], // Extract org from BU ID
      businessUnitId: defaultBusinessUnitId,
      brandId: defaultBrandId,
      salesOfficeId: oldVehicle.salesOfficeId,
      plantId: oldVehicle.plantId,
      locationId: oldVehicle.locationId,
      vehicleCode: oldVehicle.vehicleCode || oldVehicle.stockNumber,
      vin: oldVehicle.vin,
      stockNumber: oldVehicle.stockNumber,
      model: oldVehicle.model,
      variant: oldVehicle.variant,
      year: oldVehicle.year,
      color: oldVehicle.color,
      condition: oldVehicle.condition || 'NEW',
      stockType: oldVehicle.stockType || 'NEW_STOCK',
      status: oldVehicle.status || 'AVAILABLE',
      price: oldVehicle.price,
      currency: oldVehicle.currency || 'AED',
      mileage: oldVehicle.mileage || 0,
      isActive: oldVehicle.isActive !== false,
    };
  }

  /**
   * Maps old TestDrive to new TestDriveNew structure
   */
  static mapLegacyTestDriveToNew(oldTestDrive: any, defaultBusinessUnitId: string, defaultBrandId: string) {
    return {
      orgId: defaultBusinessUnitId.split('-')[0], // Extract org from BU ID
      businessUnitId: defaultBusinessUnitId,
      brandId: defaultBrandId,
      salesOfficeId: oldTestDrive.salesOfficeId,
      plantId: oldTestDrive.plantId,
      locationId: oldTestDrive.locationId,
      vehicleId: oldTestDrive.vehicleId,
      leadId: oldTestDrive.leadId,
      customerId: oldTestDrive.customerId,
      assignedSalesPersonId: oldTestDrive.assignedSalesPersonId,
      groId: oldTestDrive.groId,
      securityId: oldTestDrive.securityId,
      scheduledDate: oldTestDrive.scheduledDate,
      scheduledTime: oldTestDrive.scheduledTime,
      status: oldTestDrive.status || 'REQUESTED',
      googleCalendarEventId: oldTestDrive.googleCalendarEventId,
      remarks: oldTestDrive.remarks,
    };
  }

  /**
   * Maps old User with roles to new UserRoleAssignment structure
   * Assumes user roles are being migrated to hierarchy-based RBAC
   */
  static mapLegacyUserRoleAssignment(userId: string, legacyRoles: string[], defaultOrgId: string, defaultBusinessUnitId: string) {
    return legacyRoles.map((roleCode) => ({
      userId,
      roleCode, // Will need to be looked up from RoleNew collection
      orgId: defaultOrgId,
      businessUnitId: defaultBusinessUnitId,
      isPrimary: legacyRoles[0] === roleCode, // First role is primary
      isActive: true,
    }));
  }
}

/**
 * Batch Migration Service
 */
export class MigrationService {
  /**
   * Migrate all legacy locations to new hierarchy structure
   * @param defaultBusinessUnitId - BU ID to assign all locations to (during initial migration)
   * @param defaultSalesOfficeId - Sales Office ID for locations
   */
  static async migrateLocations(defaultBusinessUnitId: string, defaultSalesOfficeId: string) {
    try {
      const { Location, LocationNew } = await import('../models/index.js');

      const legacyLocations = await Location.find({ isActive: true });
      console.log(`[Migration] Found ${legacyLocations.length} legacy locations to migrate...`);

        const migratedData = legacyLocations.map((loc: any) =>
        MigrationHelper.mapLegacyLocationToNew(loc.toObject(), defaultBusinessUnitId, defaultSalesOfficeId)
      );

      const result = await LocationNew.insertMany(migratedData, { ordered: false });
      console.log(`[Migration] Successfully migrated ${result.length} locations`);

      return {
        success: true,
        totalProcessed: legacyLocations.length,
        totalMigrated: result.length,
      };
    } catch (error: any) {
      console.error('[Migration] Error migrating locations:', error);
      throw error;
    }
  }

  /**
   * Migrate all legacy vehicles to new hierarchy structure
   */
  static async migrateVehicles(defaultBusinessUnitId: string, defaultBrandId: string) {
    try {
      const { Vehicle, VehicleNew } = await import('../models/index.js');

      const legacyVehicles = await Vehicle.find({ isActive: true });
      console.log(`[Migration] Found ${legacyVehicles.length} legacy vehicles to migrate...`);

        const migratedData = legacyVehicles.map((v: any) =>
        MigrationHelper.mapLegacyVehicleToNew(v.toObject(), defaultBusinessUnitId, defaultBrandId)
      );

      const result = await VehicleNew.insertMany(migratedData, { ordered: false });
      console.log(`[Migration] Successfully migrated ${result.length} vehicles`);

      return {
        success: true,
        totalProcessed: legacyVehicles.length,
        totalMigrated: result.length,
      };
    } catch (error: any) {
      console.error('[Migration] Error migrating vehicles:', error);
      throw error;
    }
  }

  /**
   * Migrate all legacy test drives to new hierarchy structure
   */
  static async migrateTestDrives(defaultBusinessUnitId: string, defaultBrandId: string) {
    try {
      const { TestDrive, TestDriveNew } = await import('../models/index.js');

      const legacyTestDrives = await TestDrive.find({ isActive: true });
      console.log(`[Migration] Found ${legacyTestDrives.length} legacy test drives to migrate...`);

        const migratedData = legacyTestDrives.map((td: any) =>
        MigrationHelper.mapLegacyTestDriveToNew(td.toObject(), defaultBusinessUnitId, defaultBrandId)
      );

      const result = await TestDriveNew.insertMany(migratedData, { ordered: false });
      console.log(`[Migration] Successfully migrated ${result.length} test drives`);

      return {
        success: true,
        totalProcessed: legacyTestDrives.length,
        totalMigrated: result.length,
      };
    } catch (error: any) {
      console.error('[Migration] Error migrating test drives:', error);
      throw error;
    }
  }

  /**
   * Run complete migration (all entities)
   */
  static async runCompleteMigration(defaultBusinessUnitId: string, defaultSalesOfficeId: string, defaultBrandId: string) {
    try {
      console.log('[Migration] Starting complete migration...');
      const startTime = Date.now();

      const locationResults = await this.migrateLocations(defaultBusinessUnitId, defaultSalesOfficeId);
      const vehicleResults = await this.migrateVehicles(defaultBusinessUnitId, defaultBrandId);
      const testDriveResults = await this.migrateTestDrives(defaultBusinessUnitId, defaultBrandId);

      const elapsedSeconds = (Date.now() - startTime) / 1000;
      const summary = {
        success: true,
        locations: locationResults,
        vehicles: vehicleResults,
        testDrives: testDriveResults,
        totalTime: `${elapsedSeconds.toFixed(2)}s`,
      };

      console.log('[Migration] ✅ Migration complete:', JSON.stringify(summary, null, 2));
      return summary;
    } catch (error) {
      console.error('[Migration] ❌ Migration failed:', error);
      throw error;
    }
  }

  /**
   * Validate migration - check if new entities match legacy ones
   */
  static async validateMigration() {
    try {
      const { Location, LocationNew, Vehicle, VehicleNew, TestDrive, TestDriveNew } = await import('../models/index.js');

      const legacyLocCount = await Location.countDocuments();
      const newLocCount = await LocationNew.countDocuments();

      const legacyVehCount = await Vehicle.countDocuments();
      const newVehCount = await VehicleNew.countDocuments();

      const legacyTDCount = await TestDrive.countDocuments();
      const newTDCount = await TestDriveNew.countDocuments();

      const validation = {
        locations: { legacy: legacyLocCount, new: newLocCount, match: legacyLocCount === newLocCount },
        vehicles: { legacy: legacyVehCount, new: newVehCount, match: legacyVehCount === newVehCount },
        testDrives: { legacy: legacyTDCount, new: newTDCount, match: legacyTDCount === newTDCount },
      };

      console.log('[Migration] Validation results:', JSON.stringify(validation, null, 2));
      return validation;
    } catch (error) {
      console.error('[Migration] Error validating migration:', error);
      throw error;
    }
  }
}
