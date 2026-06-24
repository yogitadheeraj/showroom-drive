import { Request, Response, NextFunction } from 'express';
import { z, ZodSchema } from 'zod';

/**
 * Generic validation middleware using Zod
 * Validates request body, params, or query against provided schema
 */
export function validateRequest(schema: ZodSchema, source: 'body' | 'params' | 'query' = 'body') {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = source === 'body' ? req.body : source === 'params' ? req.params : req.query;
      const validated = schema.parse(data);
      
      // Replace with validated data
      if (source === 'body') req.body = validated;
      else if (source === 'params') req.params = validated as any;
      else req.query = validated as any;
      
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Validation failed',
          details: error.errors,
        });
      }
      next(error);
    }
  };
}

// Common schemas
export const idSchema = z.string().min(24, 'Invalid ID format').max(24);
export const mongoIdSchema = z.string().regex(/^[0-9a-f]{24}$/i, 'Invalid MongoDB ID');

// Organization validation schemas
export const createOrganizationSchema = z.object({
  name: z.string().min(2).max(200),
  code: z.string().min(1).max(50).regex(/^[A-Z0-9]+$/),
  type: z.enum(['GROUP', 'ENTITY', 'COMPANY']).optional(),
  country: z.string().min(2).max(2),
});

// Business Unit validation schemas
export const createBusinessUnitSchema = z.object({
  orgId: mongoIdSchema,
  name: z.string().min(2).max(200),
  code: z.string().min(1).max(50).regex(/^[A-Z0-9]+$/),
  businessType: z.enum(['BRAND_DEALER', 'USED_CAR_MARKETPLACE']),
});

// Sales Office validation schemas
export const createSalesOfficeSchema = z.object({
  orgId: mongoIdSchema,
  businessUnitId: mongoIdSchema,
  name: z.string().min(2).max(200),
  externalSalesOfficeId: z.string().optional().nullable(),
  country: z.string().min(2).max(2),
  city: z.string().min(2).max(100),
});

// Plant validation schemas
export const createPlantSchema = z.object({
  orgId: mongoIdSchema,
  businessUnitId: mongoIdSchema,
  salesOfficeId: mongoIdSchema,
  name: z.string().min(2).max(200),
  externalPlantId: z.string().optional().nullable(),
  plantType: z.enum(['SHOWROOM', 'STOCKYARD', 'WORKSHOP', 'BRANCH']),
  country: z.string().min(2).max(2),
  city: z.string().min(2).max(100),
});

// Location validation schemas
export const createLocationSchema = z.object({
  orgId: mongoIdSchema,
  businessUnitId: mongoIdSchema,
  salesOfficeId: mongoIdSchema,
  plantId: mongoIdSchema,
  name: z.string().min(2).max(200),
  externalLocationId: z.string().optional().nullable(),
  locationType: z.enum(['SHOWROOM', 'TEST_DRIVE_AREA', 'STOCK_AREA', 'DELIVERY_AREA', 'SERVICE_AREA']),
  address: z.string().min(5).max(500),
  latitude: z.number().optional().nullable(),
  longitude: z.number().optional().nullable(),
});

// Vehicle validation schemas
export const createVehicleSchema = z.object({
  orgId: mongoIdSchema,
  businessUnitId: mongoIdSchema,
  brandId: mongoIdSchema,
  model: z.string().min(1).max(100),
  variant: z.string().min(1).max(100),
  year: z.number().int().min(1900).max(new Date().getFullYear() + 1),
  color: z.string().min(1).max(50),
  condition: z.enum(['NEW', 'USED']),
  stockType: z.enum(['NEW_STOCK', 'PRE_OWNED', 'DEMO', 'CERTIFIED_PRE_OWNED']),
  price: z.number().positive(),
  currency: z.string().min(3).max(3).optional(),
  vin: z.string().optional().nullable(),
  stockNumber: z.string().optional().nullable(),
  mileage: z.number().optional().nullable(),
  salesOfficeId: mongoIdSchema.optional().nullable(),
  plantId: mongoIdSchema.optional().nullable(),
  locationId: mongoIdSchema.optional().nullable(),
});

// User Role Assignment validation schemas
export const assignUserRoleSchema = z.object({
  userId: z.string().min(1),
  roleId: mongoIdSchema,
  orgId: mongoIdSchema,
  businessUnitId: mongoIdSchema.optional().nullable(),
  brandId: mongoIdSchema.optional().nullable(),
  salesOfficeId: mongoIdSchema.optional().nullable(),
  plantId: mongoIdSchema.optional().nullable(),
  locationId: mongoIdSchema.optional().nullable(),
  isPrimary: z.boolean().optional(),
});
