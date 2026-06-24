import mongoose, { Schema, Document } from 'mongoose';

export interface IHierarchyAuditLog extends Document {
  // Audit Identity
  userId: string; // User who performed the action
  userEmail: string;
  userName: string;

  // Action Details
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'ASSIGN' | 'BULK_OPERATION';
  entityType: 'Organization' | 'BusinessUnit' | 'Brand' | 'SalesOffice' | 'Plant' | 'Location' | 'Vehicle' | 'Lead' | 'TestDrive' | 'UserRole' | 'Permission';
  entityId: string;
  entityName?: string;

  // Scope Context
  orgId: mongoose.Types.ObjectId;
  businessUnitId?: mongoose.Types.ObjectId;
  salesOfficeId?: mongoose.Types.ObjectId;
  plantId?: mongoose.Types.ObjectId;
  locationId?: mongoose.Types.ObjectId;

  // Change Tracking
  oldValues?: Record<string, any>; // Previous state
  newValues?: Record<string, any>; // New state
  changedFields?: string[]; // Fields that changed
  changeSummary?: string; // Human-readable summary

  // Request Context
  ipAddress?: string;
  userAgent?: string;
  requestId?: string; // Correlation ID for batch operations

  // Status
  status: 'SUCCESS' | 'FAILURE';
  errorMessage?: string;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

const HierarchyAuditLogSchema = new Schema<IHierarchyAuditLog>(
  {
    userId: { type: String, required: true, index: true },
    userEmail: { type: String, required: true },
    userName: { type: String },
    action: { type: String, enum: ['CREATE', 'UPDATE', 'DELETE', 'ASSIGN', 'BULK_OPERATION'], required: true },
    entityType: {
      type: String,
      enum: ['Organization', 'BusinessUnit', 'Brand', 'SalesOffice', 'Plant', 'Location', 'Vehicle', 'Lead', 'TestDrive', 'UserRole', 'Permission'],
      required: true,
    },
    entityId: { type: String, required: true, index: true },
    entityName: String,
    orgId: { type: Schema.Types.ObjectId, required: true, index: true },
    businessUnitId: { type: Schema.Types.ObjectId },
    salesOfficeId: { type: Schema.Types.ObjectId },
    plantId: { type: Schema.Types.ObjectId },
    locationId: { type: Schema.Types.ObjectId },
    oldValues: { type: Schema.Types.Mixed },
    newValues: { type: Schema.Types.Mixed },
    changedFields: [String],
    changeSummary: String,
    ipAddress: String,
    userAgent: String,
    requestId: { type: String, index: true },
    status: { type: String, enum: ['SUCCESS', 'FAILURE'], required: true, index: true },
    errorMessage: String,
  },
  { timestamps: true }
);

// Compound indexes for efficient querying
HierarchyAuditLogSchema.index({ orgId: 1, createdAt: -1 });
HierarchyAuditLogSchema.index({ entityType: 1, entityId: 1, createdAt: -1 });
HierarchyAuditLogSchema.index({ userId: 1, createdAt: -1 });
HierarchyAuditLogSchema.index({ businessUnitId: 1, createdAt: -1 });
HierarchyAuditLogSchema.index({ action: 1, status: 1 });
HierarchyAuditLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 7776000 }); // Auto-delete after 90 days

export default mongoose.model<IHierarchyAuditLog>('HierarchyAuditLog', HierarchyAuditLogSchema);
