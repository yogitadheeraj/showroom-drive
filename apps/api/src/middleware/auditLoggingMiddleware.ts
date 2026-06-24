import { Request, Response, NextFunction } from 'express';
import { AuditLogService } from '../services/advancedHierarchyService.js';

/**
 * Middleware to automatically log hierarchy operations
 * Should be applied to all hierarchy routes
 */
export interface AuditableRequest extends Request {
  auditData?: {
    action: 'CREATE' | 'UPDATE' | 'DELETE' | 'ASSIGN' | 'BULK_OPERATION';
    entityType: string;
    entityId?: string;
    oldValues?: any;
  };
}

export const auditLoggingMiddleware = () => {
  return async (req: AuditableRequest, res: Response, next: NextFunction) => {
    // Capture response body for audit logging
    const originalJson = res.json.bind(res);

    res.json = function (body: any) {
      if (req.auditData && req.auth) {
        // Only log successful operations (status < 400)
        if (res.statusCode < 400) {
          const auditPayload = {
            userId: req.auth.user?.id || 'unknown',
            userEmail: req.auth.user?.email || 'unknown',
            userName: req.auth.user?.name,
            action: req.auditData.action,
            entityType: req.auditData.entityType,
            entityId: req.auditData.entityId || body._id || body.id,
            entityName: body.name || body.code,
            orgId: req.auth.scope?.orgId,
            businessUnitId: req.auth.scope?.businessUnitId,
            salesOfficeId: req.auth.scope?.salesOfficeId,
            plantId: req.auth.scope?.plantId,
            locationId: req.auth.scope?.locationId,
            oldValues: req.auditData.oldValues,
            newValues: body,
            ipAddress: req.ip,
            userAgent: req.get('user-agent'),
            requestId: req.get('x-request-id'),
            status: 'SUCCESS',
          };

          // Fire-and-forget audit logging
          AuditLogService.logAction(auditPayload).catch((err) => {
            console.error('[AuditLoggingMiddleware] Error logging audit:', err);
          });
        }
      }

      return originalJson(body);
    };

    next();
  };
};

/**
 * Helper to mark a request as auditable
 */
export const markAuditable = (req: AuditableRequest, action: 'CREATE' | 'UPDATE' | 'DELETE' | 'ASSIGN' | 'BULK_OPERATION', entityType: string, oldValues?: any) => {
  req.auditData = {
    action,
    entityType,
    oldValues,
  };
};
