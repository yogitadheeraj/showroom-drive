import mongoose, { Document, Schema } from 'mongoose';

export type TestDriveStatus =
  | 'scheduled'
  | 'confirmed'
  | 'show'
  | 'in_progress'
  | 'completed'
  | 'no_show'
  | 'cancelled'
  | 'rescheduled';

export interface ITestDrive extends Document {
  id: string;
  customer_id: string;
  vehicle_id: string;
  location_id: string;
  sales_person_id: string | null;
  gro_id: string | null;
  security_guard_id: string | null;
  status: TestDriveStatus;
  scheduled_date: string;
  scheduled_time: string;
  actual_start_time: string | null;
  actual_end_time: string | null;
  duration_minutes: number | null;
  odometer_start: number | null;
  odometer_end: number | null;
  fuel_level_start: string | null;
  fuel_level_end: string | null;
  notes: string | null;
  cancellation_reason: string | null;
  feedback_submitted: boolean;
  inspection_checklist: Record<string, unknown> | null;
  stage: string | null;
  created_at: string;
  updated_at: string;
}

const TestDriveSchema = new Schema<ITestDrive>(
  {
    id: { type: String, required: true, unique: true, index: true },
    customer_id: { type: String, required: true, index: true },
    vehicle_id: { type: String, required: true, index: true },
    location_id: { type: String, required: true, index: true },
    sales_person_id: { type: String, default: null, index: true },
    gro_id: { type: String, default: null },
    security_guard_id: { type: String, default: null },
    status: {
      type: String,
      enum: ['scheduled', 'confirmed', 'show', 'in_progress', 'completed', 'no_show', 'cancelled', 'rescheduled'],
      default: 'scheduled',
      index: true,
    },
    scheduled_date: { type: String, required: true, index: true },
    scheduled_time: { type: String, required: true },
    actual_start_time: { type: String, default: null },
    actual_end_time: { type: String, default: null },
    duration_minutes: { type: Number, default: null },
    odometer_start: { type: Number, default: null },
    odometer_end: { type: Number, default: null },
    fuel_level_start: { type: String, default: null },
    fuel_level_end: { type: String, default: null },
    notes: { type: String, default: null },
    cancellation_reason: { type: String, default: null },
    feedback_submitted: { type: Boolean, default: false },
    inspection_checklist: { type: Schema.Types.Mixed, default: null },
    stage: { type: String, default: null },
    created_at: { type: String, default: () => new Date().toISOString() },
    updated_at: { type: String, default: () => new Date().toISOString() },
  },
  { versionKey: false, collection: 'test_drives' },
);

TestDriveSchema.pre('save', function (next) {
  this.updated_at = new Date().toISOString();
  next();
});

TestDriveSchema.index({ scheduled_date: 1, status: 1 });
TestDriveSchema.index({ location_id: 1, scheduled_date: 1 });

export const TestDrive = mongoose.models['TestDrive'] as mongoose.Model<ITestDrive> || mongoose.model<ITestDrive>('TestDrive', TestDriveSchema);
