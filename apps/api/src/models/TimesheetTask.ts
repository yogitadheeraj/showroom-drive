import mongoose, { Document, Schema } from 'mongoose';

export type TimesheetTaskStatus = 'pending' | 'submitted' | 'missed' | 'cancelled';

export interface ITimesheetTask extends Document {
  id: string;
  user_id: string;
  profile_id: string | null;
  location_id: string;
  dealer_id: string | null;
  task_title: string;
  due_at: string;
  status: TimesheetTaskStatus;
  submitted_at: string | null;
  sent_offsets: number[];
  last_reminder_at: string | null;
  escalated_at: string | null;
  metadata: Record<string, unknown> | null;
  created_by_profile_id: string | null;
  created_at: string;
  updated_at: string;
}

const TimesheetTaskSchema = new Schema<ITimesheetTask>(
  {
    id: { type: String, required: true, unique: true, index: true },
    user_id: { type: String, required: true, index: true },
    profile_id: { type: String, default: null, index: true },
    location_id: { type: String, required: true, index: true },
    dealer_id: { type: String, default: null, index: true },
    task_title: { type: String, required: true },
    due_at: { type: String, required: true, index: true },
    status: {
      type: String,
      enum: ['pending', 'submitted', 'missed', 'cancelled'],
      default: 'pending',
      index: true,
    },
    submitted_at: { type: String, default: null },
    sent_offsets: { type: [Number], default: [] },
    last_reminder_at: { type: String, default: null },
    escalated_at: { type: String, default: null },
    metadata: { type: Schema.Types.Mixed, default: null },
    created_by_profile_id: { type: String, default: null },
    created_at: { type: String, default: () => new Date().toISOString() },
    updated_at: { type: String, default: () => new Date().toISOString() },
  },
  { versionKey: false, collection: 'timesheet_tasks' },
);

TimesheetTaskSchema.index({ location_id: 1, due_at: 1, status: 1 });
TimesheetTaskSchema.index({ user_id: 1, due_at: 1 });

export const TimesheetTask =
  (mongoose.models['TimesheetTask'] as mongoose.Model<ITimesheetTask>) ||
  mongoose.model<ITimesheetTask>('TimesheetTask', TimesheetTaskSchema);
