import mongoose, { Schema, Document } from 'mongoose';

export interface IHierarchyReport extends Document {
  // Report Identity
  orgId: mongoose.Types.ObjectId;
  businessUnitId?: mongoose.Types.ObjectId;
  generatedBy: string; // User ID
  generatedByEmail: string;

  // Report Configuration
  name: string;
  reportType: 'HIERARCHY_SUMMARY' | 'ROLE_PERMISSIONS' | 'USER_ASSIGNMENTS' | 'VEHICLE_INVENTORY' | 'ACTIVITY_LOG' | 'AUDIT_TRAIL' | 'CUSTOM';
  description?: string;

  // Filters & Parameters
  dateRange: {
    startDate: Date;
    endDate: Date;
  };
  filters?: {
    businessUnitIds?: string[];
    salesOfficeIds?: string[];
    plantIds?: string[];
    locationIds?: string[];
    userIds?: string[];
    entityTypes?: string[];
    actions?: string[];
  };

  // Report Data
  data: {
    totalRecords: number;
    summary: Record<string, any>; // High-level metrics
    details: any[]; // Detailed data rows
    charts?: Array<{
      title: string;
      type: 'pie' | 'bar' | 'line' | 'table';
      data: Record<string, any>;
    }>;
  };

  // Metadata
  format: 'JSON' | 'CSV' | 'PDF' | 'XLSX';
  fileUrl?: string; // S3/Storage URL if exported
  fileSize?: number; // bytes

  // Status & Scheduling
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  errorMessage?: string;
  processingTimeMs?: number;

  // Scheduling (optional)
  isScheduled: boolean;
  scheduleFrequency?: 'DAILY' | 'WEEKLY' | 'MONTHLY'; // If scheduled
  nextScheduleDate?: Date;
  recipients?: string[]; // Email addresses for scheduled reports

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

const HierarchyReportSchema = new Schema<IHierarchyReport>(
  {
    orgId: { type: Schema.Types.ObjectId, required: true, index: true },
    businessUnitId: { type: Schema.Types.ObjectId },
    generatedBy: { type: String, required: true },
    generatedByEmail: { type: String, required: true },
    name: { type: String, required: true },
    reportType: {
      type: String,
      enum: ['HIERARCHY_SUMMARY', 'ROLE_PERMISSIONS', 'USER_ASSIGNMENTS', 'VEHICLE_INVENTORY', 'ACTIVITY_LOG', 'AUDIT_TRAIL', 'CUSTOM'],
      required: true,
    },
    description: String,
    dateRange: {
      startDate: { type: Date, required: true },
      endDate: { type: Date, required: true },
    },
    filters: { type: Schema.Types.Mixed },
    data: {
      totalRecords: { type: Number, required: true },
      summary: { type: Schema.Types.Mixed, required: true },
      details: { type: [Schema.Types.Mixed], required: true },
      charts: [
        {
          title: String,
          type: { type: String, enum: ['pie', 'bar', 'line', 'table'] },
          data: Schema.Types.Mixed,
        },
      ],
    },
    format: { type: String, enum: ['JSON', 'CSV', 'PDF', 'XLSX'], default: 'JSON' },
    fileUrl: String,
    fileSize: Number,
    status: { type: String, enum: ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED'], default: 'PENDING', index: true },
    errorMessage: String,
    processingTimeMs: Number,
    isScheduled: { type: Boolean, default: false },
    scheduleFrequency: { type: String, enum: ['DAILY', 'WEEKLY', 'MONTHLY'] },
    nextScheduleDate: Date,
    recipients: [String],
  },
  { timestamps: true }
);

HierarchyReportSchema.index({ orgId: 1, createdAt: -1 });
HierarchyReportSchema.index({ generatedBy: 1, createdAt: -1 });
HierarchyReportSchema.index({ reportType: 1, status: 1 });
HierarchyReportSchema.index({ createdAt: 1 }, { expireAfterSeconds: 15552000 }); // Auto-delete after 180 days

export default mongoose.model<IHierarchyReport>('HierarchyReport', HierarchyReportSchema);
