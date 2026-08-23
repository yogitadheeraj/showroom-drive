import mongoose, { Document, Schema } from 'mongoose';

export interface IServiceBookingOtp extends Document {
  id: string;
  phone: string;
  code: string;
  purpose: 'lookup';
  attempts: number;
  max_attempts: number;
  expires_at: string;
  verified_at: string | null;
  verification_token: string | null;
  verification_expires_at: string | null;
  created_at: string;
  updated_at: string;
}

const ServiceBookingOtpSchema = new Schema<IServiceBookingOtp>(
  {
    id: { type: String, required: true, unique: true, index: true },
    phone: { type: String, required: true, index: true },
    code: { type: String, required: true },
    purpose: { type: String, enum: ['lookup'], default: 'lookup', index: true },
    attempts: { type: Number, default: 0 },
    max_attempts: { type: Number, default: 5 },
    expires_at: { type: String, required: true, index: true },
    verified_at: { type: String, default: null },
    verification_token: { type: String, default: null, index: true },
    verification_expires_at: { type: String, default: null, index: true },
    created_at: { type: String, default: () => new Date().toISOString() },
    updated_at: { type: String, default: () => new Date().toISOString() },
  },
  { collection: 'service_booking_otps', versionKey: false },
);

ServiceBookingOtpSchema.pre('save', function (next) {
  this.updated_at = new Date().toISOString();
  next();
});

ServiceBookingOtpSchema.index({ phone: 1, purpose: 1, created_at: -1 });

export const ServiceBookingOtp =
  (mongoose.models['ServiceBookingOtp'] as mongoose.Model<IServiceBookingOtp>) ||
  mongoose.model<IServiceBookingOtp>('ServiceBookingOtp', ServiceBookingOtpSchema);
