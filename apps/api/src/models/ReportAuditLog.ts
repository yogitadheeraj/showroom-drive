import mongoose, { Document, Schema } from 'mongoose';

export type ReportAuditAction = 'download' | 'send_queued' | 'schedule_dispatch';
export type ReportAuditStatus = 'success' | 'failed';

export interface IReportAuditLog extends Document {
  id: string;
  action: ReportAuditAction;
  status: ReportAuditStatus;
  location_id: string;
  report_type: 'test_drive_daily' | 'activity_daily';
  report_date: string;
  format: 'excel' | 'pdf' | 'mixed' | null;
  recipient_email: string | null;
  actor_user_id: string | null;
  message: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

const ReportAuditLogSchema = new Schema<IReportAuditLog>(
  {
    id: { type: String, required: true, unique: true, index: true },
    action: { type: String, enum: ['download', 'send_queued', 'schedule_dispatch'], required: true, index: true },
    status: { type: String, enum: ['success', 'failed'], required: true, index: true },
    location_id: { type: String, required: true, index: true },
    report_type: { type: String, enum: ['test_drive_daily', 'activity_daily'], required: true, index: true },
    report_date: { type: String, required: true, index: true },
    format: { type: String, enum: ['excel', 'pdf', 'mixed', null], default: null },
    recipient_email: { type: String, default: null, index: true },
    actor_user_id: { type: String, default: null, index: true },
    message: { type: String, default: null },
    metadata: { type: Schema.Types.Mixed, default: null },
    created_at: { type: String, default: () => new Date().toISOString(), index: true },
  },
  { versionKey: false, collection: 'report_audit_logs' },
);

ReportAuditLogSchema.index({ location_id: 1, created_at: -1 });

export const ReportAuditLog =
  (mongoose.models['ReportAuditLog'] as mongoose.Model<IReportAuditLog>) ||
  mongoose.model<IReportAuditLog>('ReportAuditLog', ReportAuditLogSchema);
