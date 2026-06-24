import crypto from 'crypto';
import axios from 'axios';
import HierarchyAuditLog from '../models/HierarchyAuditLog.js';
import HierarchyWebhook from '../models/HierarchyWebhook.js';
import HierarchyWebhookEvent from '../models/HierarchyWebhookEvent.js';
import HierarchyReport from '../models/HierarchyReport.js';
import mongoose from 'mongoose';

/**
 * ==================== Audit Log Service ====================
 */
export class AuditLogService {
  static async logAction(data: {
    userId: string;
    userEmail: string;
    userName?: string;
    action: 'CREATE' | 'UPDATE' | 'DELETE' | 'ASSIGN' | 'BULK_OPERATION';
    entityType: string;
    entityId: string;
    entityName?: string;
    orgId: string;
    businessUnitId?: string;
    salesOfficeId?: string;
    plantId?: string;
    locationId?: string;
    oldValues?: any;
    newValues?: any;
    ipAddress?: string;
    userAgent?: string;
    requestId?: string;
    status?: 'SUCCESS' | 'FAILURE';
    errorMessage?: string;
  }) {
    try {
      const changedFields: string[] = [];
      if (data.oldValues && data.newValues) {
        const allKeys = new Set([...Object.keys(data.oldValues), ...Object.keys(data.newValues)]);
        for (const key of allKeys) {
          if (JSON.stringify(data.oldValues[key]) !== JSON.stringify(data.newValues[key])) {
            changedFields.push(key);
          }
        }
      }

      const auditLog = new HierarchyAuditLog({
        userId: data.userId,
        userEmail: data.userEmail,
        userName: data.userName,
        action: data.action,
        entityType: data.entityType,
        entityId: data.entityId,
        entityName: data.entityName,
        orgId: new mongoose.Types.ObjectId(data.orgId),
        businessUnitId: data.businessUnitId ? new mongoose.Types.ObjectId(data.businessUnitId) : undefined,
        salesOfficeId: data.salesOfficeId ? new mongoose.Types.ObjectId(data.salesOfficeId) : undefined,
        plantId: data.plantId ? new mongoose.Types.ObjectId(data.plantId) : undefined,
        locationId: data.locationId ? new mongoose.Types.ObjectId(data.locationId) : undefined,
        oldValues: data.oldValues,
        newValues: data.newValues,
        changedFields,
        changeSummary: this.generateSummary(data.action, data.entityType, changedFields),
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
        requestId: data.requestId,
        status: data.status || 'SUCCESS',
        errorMessage: data.errorMessage,
      });

      await auditLog.save();
      return auditLog;
    } catch (error) {
      console.error('[AuditLogService] Error logging action:', error);
    }
  }

  static generateSummary(action: string, entityType: string, changedFields: string[]): string {
    if (action === 'CREATE') {
      return `Created new ${entityType}`;
    }
    if (action === 'DELETE') {
      return `Deleted ${entityType}`;
    }
    if (action === 'UPDATE') {
      return `Updated ${entityType}: ${changedFields.join(', ')}`;
    }
    if (action === 'ASSIGN') {
      return `Assigned ${entityType}`;
    }
    return `${action} on ${entityType}`;
  }

  static async getAuditLogs(orgId: string, filters?: { entityType?: string; userId?: string; dateRange?: { start: Date; end: Date } }) {
    const query: any = { orgId: new mongoose.Types.ObjectId(orgId) };
    if (filters?.entityType) query.entityType = filters.entityType;
    if (filters?.userId) query.userId = filters.userId;
    if (filters?.dateRange) {
      query.createdAt = { $gte: filters.dateRange.start, $lte: filters.dateRange.end };
    }
    return HierarchyAuditLog.find(query).sort({ createdAt: -1 }).limit(1000);
  }
}

/**
 * ==================== Webhook Service ====================
 */
export class WebhookService {
  static async createWebhook(data: {
    orgId: string;
    businessUnitId?: string;
    createdBy: string;
    name: string;
    description?: string;
    targetUrl: string;
    events: string[];
    headers?: Record<string, string>;
    retryPolicy?: { maxRetries?: number; retryDelaySeconds?: number; backoffMultiplier?: number };
    filters?: { entityTypes?: string[]; actions?: string[] };
  }) {
    const secret = crypto.randomBytes(32).toString('hex');

    const webhook = new HierarchyWebhook({
      orgId: new mongoose.Types.ObjectId(data.orgId),
      businessUnitId: data.businessUnitId ? new mongoose.Types.ObjectId(data.businessUnitId) : undefined,
      createdBy: data.createdBy,
      name: data.name,
      description: data.description,
      targetUrl: data.targetUrl,
      secret,
      events: data.events,
      headers: data.headers,
      retryPolicy: data.retryPolicy || { maxRetries: 5, retryDelaySeconds: 60, backoffMultiplier: 2 },
      filters: data.filters,
    });

    await webhook.save();
    return webhook;
  }

  static async triggerWebhook(webhookId: string, event: any) {
    try {
      const webhook = await HierarchyWebhook.findById(webhookId);
      if (!webhook || !webhook.isActive) return;

      // Check filters
      if (webhook.filters?.entityTypes && !webhook.filters.entityTypes.includes(event.entityType)) return;
      if (webhook.filters?.actions && !webhook.filters.actions.includes(event.action)) return;

      // Create webhook event record
      const webhookEvent = new HierarchyWebhookEvent({
        webhookId: new mongoose.Types.ObjectId(webhookId),
        orgId: webhook.orgId,
        eventType: event.eventType,
        entityType: event.entityType,
        entityId: event.entityId,
        action: event.action,
        data: event,
        status: 'PENDING',
        attempts: [],
      });

      await webhookEvent.save();

      // Attempt delivery with retries
      await this.deliverWebhookEvent(webhook, webhookEvent);
    } catch (error) {
      console.error('[WebhookService] Error triggering webhook:', error);
    }
  }

  static async deliverWebhookEvent(webhook: any, event: any) {
    const maxAttempts = webhook.retryPolicy?.maxRetries || 5;
    const baseDelay = webhook.retryPolicy?.retryDelaySeconds || 60;
    const backoffMultiplier = webhook.retryPolicy?.backoffMultiplier || 2;

    for (let attemptNumber = 1; attemptNumber <= maxAttempts; attemptNumber++) {
      try {
        const signature = this.generateSignature(event.data, webhook.secret);

        const startTime = Date.now();
        const response = await axios.post(webhook.targetUrl, event.data, {
          headers: {
            'Content-Type': 'application/json',
            'X-Webhook-Signature': signature,
            'X-Webhook-Event': event.eventType,
            ...webhook.headers,
          },
          timeout: 30000,
        });
        const responseTime = Date.now() - startTime;

        event.attempts.push({
          attemptNumber,
          timestamp: new Date(),
          statusCode: response.status,
          responseTime,
        });

        if (response.status >= 200 && response.status < 300) {
          event.status = 'DELIVERED';
          event.finalAttemptAt = new Date();
          await event.save();

          webhook.successCount += 1;
          webhook.lastTriggeredAt = new Date();
          webhook.lastError = null;
          await webhook.save();
          return;
        }
      } catch (error: any) {
        event.attempts.push({
          attemptNumber,
          timestamp: new Date(),
          error: error.message,
          retryAt: attemptNumber < maxAttempts ? new Date(Date.now() + baseDelay * Math.pow(backoffMultiplier, attemptNumber - 1) * 1000) : undefined,
        });

        if (attemptNumber === maxAttempts) {
          event.status = 'FAILED';
          event.finalError = error.message;
          event.finalAttemptAt = new Date();
          webhook.failureCount += 1;
          webhook.lastError = error.message;
        }
      }

      await event.save();

      // Exponential backoff between retries
      if (attemptNumber < maxAttempts) {
        const delayMs = baseDelay * Math.pow(backoffMultiplier, attemptNumber - 1) * 1000;
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }

    await webhook.save();
  }

  static generateSignature(payload: any, secret: string): string {
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(JSON.stringify(payload));
    return hmac.digest('hex');
  }

  static async listWebhooks(orgId: string) {
    return HierarchyWebhook.find({ orgId: new mongoose.Types.ObjectId(orgId) });
  }

  static async getWebhookEvents(webhookId: string, status?: string) {
    const query: any = { webhookId: new mongoose.Types.ObjectId(webhookId) };
    if (status) query.status = status;
    return HierarchyWebhookEvent.find(query).sort({ createdAt: -1 }).limit(100);
  }
}

/**
 * ==================== Reporting Service ====================
 */
export class ReportingService {
  static async generateReport(data: {
    orgId: string;
    businessUnitId?: string;
    generatedBy: string;
    generatedByEmail: string;
    reportType: string;
    name: string;
    dateRange: { startDate: Date; endDate: Date };
    filters?: any;
    format?: string;
  }) {
    const report = new HierarchyReport({
      orgId: new mongoose.Types.ObjectId(data.orgId),
      businessUnitId: data.businessUnitId ? new mongoose.Types.ObjectId(data.businessUnitId) : undefined,
      generatedBy: data.generatedBy,
      generatedByEmail: data.generatedByEmail,
      reportType: data.reportType,
      name: data.name,
      dateRange: data.dateRange,
      filters: data.filters,
      format: data.format || 'JSON',
      status: 'PROCESSING',
      data: { totalRecords: 0, summary: {}, details: [] },
    });

    await report.save();

    // Generate report data based on type
    const startTime = Date.now();
    try {
      const reportData = await this.generateReportData(data.reportType, data);
      report.data = reportData;
      report.status = 'COMPLETED';
      report.processingTimeMs = Date.now() - startTime;
    } catch (error: any) {
      report.status = 'FAILED';
      report.errorMessage = error.message;
    }

    await report.save();
    return report;
  }

  static async generateReportData(reportType: string, config: any) {
    let details: any[] = [];
    let summary: any = {};

    if (reportType === 'HIERARCHY_SUMMARY') {
      // Fetch organization hierarchy structure
      const { Organization, BrandNew, SalesOffice, Plant, LocationNew } = await import('../models/index.js');
      const orgs = await Organization.find({ _id: config.orgId });
      const busiUnits = await BrandNew.find({ orgId: config.orgId });
      const salesOffices = await SalesOffice.find({ orgId: config.orgId });
      const plants = await Plant.find({ orgId: config.orgId });
      const locations = await LocationNew.find({ orgId: config.orgId });

      details = [{ orgs, busiUnits, salesOffices, plants, locations }];
      summary = {
        totalOrganizations: orgs.length,
        totalBusinessUnits: busiUnits.length,
        totalSalesOffices: salesOffices.length,
        totalPlants: plants.length,
        totalLocations: locations.length,
      };
    } else if (reportType === 'AUDIT_TRAIL') {
      const auditLogs = await HierarchyAuditLog.find({
        orgId: new mongoose.Types.ObjectId(config.orgId),
        createdAt: { $gte: config.dateRange.startDate, $lte: config.dateRange.endDate },
      }).sort({ createdAt: -1 });

      details = auditLogs;
      summary = {
        totalAuditLogs: auditLogs.length,
        actionCounts: auditLogs.reduce(
          (acc, log) => {
            acc[log.action] = (acc[log.action] || 0) + 1;
            return acc;
          },
          {} as Record<string, number>
        ),
        userCounts: auditLogs.reduce(
          (acc, log) => {
            acc[log.userEmail] = (acc[log.userEmail] || 0) + 1;
            return acc;
          },
          {} as Record<string, number>
        ),
      };
    }

    return {
      totalRecords: details.length,
      summary,
      details,
    };
  }

  static async listReports(orgId: string, reportType?: string) {
    const query: any = { orgId: new mongoose.Types.ObjectId(orgId) };
    if (reportType) query.reportType = reportType;
    return HierarchyReport.find(query).sort({ createdAt: -1 }).limit(50);
  }

  static async getReport(reportId: string) {
    return HierarchyReport.findById(reportId);
  }
}
