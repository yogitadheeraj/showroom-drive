import mongoose, { Document, Schema } from 'mongoose';

export type ReportDispatchType = 'test_drive_daily' | 'activity_daily';
export type ReportDispatchFormat = 'excel' | 'pdf';
export type ReportDispatchRecipientRole = 'dealer_admin' | 'sales';

export interface IReportDispatchConfig extends Document {
  id: string;
  location_id: string;
  report_type: ReportDispatchType;
  enabled: boolean;
  send_time_utc: string;
  recipient_roles: ReportDispatchRecipientRole[];
  formats: ReportDispatchFormat[];
  last_dispatched_for_date: string | null;
  created_by_user_id: string;
  updated_by_user_id: string;
  created_at: string;
  updated_at: string;
}

const ReportDispatchConfigSchema = new Schema<IReportDispatchConfig>(
  {
    id: { type: String, required: true, unique: true, index: true },
    location_id: { type: String, required: true, index: true },
    report_type: {
      type: String,
      enum: ['test_drive_daily', 'activity_daily'],
      required: true,
      default: 'test_drive_daily',
      index: true,
    },
    enabled: { type: Boolean, default: true, index: true },
    send_time_utc: {
      type: String,
      required: true,
      default: '18:00',
      validate: {
        validator: (v: string) => /^([01]\d|2[0-3]):([0-5]\d)$/.test(v),
        message: 'send_time_utc must be in HH:mm format',
      },
    },
    recipient_roles: {
      type: [String],
      enum: ['dealer_admin', 'sales'],
      default: ['dealer_admin'],
    },
    formats: {
      type: [String],
      enum: ['excel', 'pdf'],
      default: ['excel'],
    },
    last_dispatched_for_date: { type: String, default: null },
    created_by_user_id: { type: String, required: true },
    updated_by_user_id: { type: String, required: true },
    created_at: { type: String, default: () => new Date().toISOString() },
    updated_at: { type: String, default: () => new Date().toISOString() },
  },
  { versionKey: false, collection: 'report_dispatch_configs' },
);

ReportDispatchConfigSchema.index({ location_id: 1, report_type: 1 }, { unique: true });

ReportDispatchConfigSchema.pre('save', function (next) {
  this.updated_at = new Date().toISOString();
  next();
});

export const ReportDispatchConfig =
  (mongoose.models['ReportDispatchConfig'] as mongoose.Model<IReportDispatchConfig>) ||
  mongoose.model<IReportDispatchConfig>('ReportDispatchConfig', ReportDispatchConfigSchema);
