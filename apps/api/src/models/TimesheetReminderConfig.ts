import mongoose, { Document, Schema } from 'mongoose';

export interface ITimesheetReminderConfig extends Document {
  id: string;
  location_id: string;
  dealer_id: string | null;
  reminder_enabled: boolean;
  reminder_offsets_minutes: number[];
  reminder_message: string;
  timezone: string;
  grace_after_due_minutes: number;
  escalate_to_manager: boolean;
  updated_by_profile_id: string | null;
  created_at: string;
  updated_at: string;
}

const TimesheetReminderConfigSchema = new Schema<ITimesheetReminderConfig>(
  {
    id: { type: String, required: true, unique: true, index: true },
    location_id: { type: String, required: true, unique: true, index: true },
    dealer_id: { type: String, default: null, index: true },
    reminder_enabled: { type: Boolean, default: true },
    reminder_offsets_minutes: { type: [Number], default: [30, 15] },
    reminder_message: {
      type: String,
      default: 'Timesheet due in {{minutes}} minutes at {{dueAt}} for {{taskTitle}}.',
    },
    timezone: { type: String, default: 'Asia/Kolkata' },
    grace_after_due_minutes: { type: Number, default: 5 },
    escalate_to_manager: { type: Boolean, default: true },
    updated_by_profile_id: { type: String, default: null },
    created_at: { type: String, default: () => new Date().toISOString() },
    updated_at: { type: String, default: () => new Date().toISOString() },
  },
  { versionKey: false, collection: 'timesheet_reminder_configs' },
);

TimesheetReminderConfigSchema.index({ dealer_id: 1, location_id: 1 });

export const TimesheetReminderConfig =
  (mongoose.models['TimesheetReminderConfig'] as mongoose.Model<ITimesheetReminderConfig>) ||
  mongoose.model<ITimesheetReminderConfig>('TimesheetReminderConfig', TimesheetReminderConfigSchema);
