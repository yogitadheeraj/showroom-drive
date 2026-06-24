import mongoose, { Document, Schema } from 'mongoose';

export interface ILocation extends Document {
  id: string;
  dealer_id: string | null;
  brand_id: string | null;
  parent_location_id: string | null;
  hierarchy_level: 'brand_branch' | 'branch' | 'location' | null;
  name: string;
  city: string | null;
  state: string | null;
  country: string | null;
  brands: { name: string; is_active: boolean }[];
  address: string | null;
  pincode: string | null;
  phone: string | null;
  email: string | null;
  latitude: string | null;
  longitude: string | null;
  googleplaceid: string | null;
  maplink: string | null;
  currency_type: string | null;
  is_active: boolean;
  slot_duration_minutes: number;
  max_concurrent_test_drives: number;
  advance_booking_days: number;
  public_booking_rate_limit_minutes: number;
  time_zone: string | null;
  created_at: string;
  updated_at: string;
}

const LocationSchema = new Schema<ILocation>(
  {
    id: { type: String, required: true, unique: true, index: true },
    dealer_id: { type: String, default: null, index: true },
    brand_id: { type: String, default: null, index: true },
    parent_location_id: { type: String, default: null, index: true },
    hierarchy_level: { type: String, enum: ['brand_branch', 'branch', 'location', null], default: null },
    name: { type: String, required: true },
    city: { type: String, default: null },
    state: { type: String, default: null },
    country: { type: String, default: null },
    brands: { type: [{ name: String, is_active: Boolean }], default: [] },
    address: { type: String, default: null },
    pincode: { type: String, default: null },
    phone: { type: String, default: null },
    email: { type: String, default: null },
    latitude: { type: String, default: null },
    longitude: { type: String, default: null },
    googleplaceid: { type: String, default: null },
    maplink: { type: String, default: null },
    currency_type: { type: String, default: null },
    is_active: { type: Boolean, default: true },
    slot_duration_minutes: { type: Number, default: 30 },
    max_concurrent_test_drives: { type: Number, default: 1 },
    advance_booking_days: { type: Number, default: 30 },
    public_booking_rate_limit_minutes: { type: Number, default: 10 },
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
