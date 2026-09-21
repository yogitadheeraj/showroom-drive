import mongoose, { Document, Schema } from 'mongoose';

export type CollectionMode = 'deposit' | 'full';
export type DepositType = 'fixed' | 'percentage';

export interface ICarBookingPaymentConfig extends Document {
  id: string;
  location_id: string;
  dealer_id: string | null;
  payment_module_enabled: boolean;
  allow_deposit: boolean;
  allow_full_payment: boolean;
  default_collection_mode: CollectionMode;
  deposit_type: DepositType;
  deposit_value: number;
  provider_name: string;
  payment_link_base_url: string | null;
  enable_upi: boolean;
  enable_card: boolean;
  enable_net_banking: boolean;
  enable_wallet: boolean;
  updated_by_profile_id: string | null;
  created_at: string;
  updated_at: string;
}

const CarBookingPaymentConfigSchema = new Schema<ICarBookingPaymentConfig>(
  {
    id: { type: String, required: true, unique: true, index: true },
    location_id: { type: String, required: true, index: true, unique: true },
    dealer_id: { type: String, default: null, index: true },
    payment_module_enabled: { type: Boolean, default: false },
    allow_deposit: { type: Boolean, default: true },
    allow_full_payment: { type: Boolean, default: true },
    default_collection_mode: {
      type: String,
      enum: ['deposit', 'full'],
      default: 'deposit',
    },
    deposit_type: {
      type: String,
      enum: ['fixed', 'percentage'],
      default: 'percentage',
    },
    deposit_value: { type: Number, default: 10 },
    provider_name: { type: String, default: 'manual' },
    payment_link_base_url: { type: String, default: null },
    enable_upi: { type: Boolean, default: true },
    enable_card: { type: Boolean, default: true },
    enable_net_banking: { type: Boolean, default: true },
    enable_wallet: { type: Boolean, default: false },
    updated_by_profile_id: { type: String, default: null },
    created_at: { type: String, default: () => new Date().toISOString() },
    updated_at: { type: String, default: () => new Date().toISOString() },
  },
  { collection: 'car_booking_payment_config', versionKey: false },
);

CarBookingPaymentConfigSchema.pre('save', function (next) {
  this.updated_at = new Date().toISOString();
  next();
});

export const CarBookingPaymentConfig =
  (mongoose.models['CarBookingPaymentConfig'] as mongoose.Model<ICarBookingPaymentConfig>) ||
  mongoose.model<ICarBookingPaymentConfig>('CarBookingPaymentConfig', CarBookingPaymentConfigSchema);
