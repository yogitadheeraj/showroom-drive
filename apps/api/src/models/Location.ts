import mongoose, { Document, Schema } from 'mongoose';

export interface ILocation extends Document {
  id: string;
  dealer_id: string | null;
  name: string;
  city: string | null;
  state: string | null;
  address: string | null;
  pincode: string | null;
  phone: string | null;
  email: string | null;
  is_active: boolean;
  slot_duration_minutes: number;
  max_concurrent_test_drives: number;
  time_zone: string | null;
  created_at: string;
  updated_at: string;
}

const LocationSchema = new Schema<ILocation>(
  {
    id: { type: String, required: true, unique: true, index: true },
    dealer_id: { type: String, default: null, index: true },
    name: { type: String, required: true },
    city: { type: String, default: null },
    state: { type: String, default: null },
    address: { type: String, default: null },
    pincode: { type: String, default: null },
    phone: { type: String, default: null },
    email: { type: String, default: null },
    is_active: { type: Boolean, default: true },
    slot_duration_minutes: { type: Number, default: 30 },
    max_concurrent_test_drives: { type: Number, default: 1 },
    time_zone: { type: String, default: null },
    created_at: { type: String, default: () => new Date().toISOString() },
    updated_at: { type: String, default: () => new Date().toISOString() },
  },
  { versionKey: false, collection: 'locations' },
);

LocationSchema.pre('save', function (next) {
  this.updated_at = new Date().toISOString();
  next();
});

export const Location = mongoose.models['Location'] as mongoose.Model<ILocation> || mongoose.model<ILocation>('Location', LocationSchema);
