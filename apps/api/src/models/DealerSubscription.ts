import mongoose, { Document, Schema } from 'mongoose';

export interface IDealerSubscription extends Document {
  id: string;
  dealer_id: string;
  package_name: string;
  billing_period: 'monthly' | 'yearly';
  expires_at: string | null;
  is_active: boolean;
  notes: string | null;
  expiry_notified_at: string | null;
  expiry_soon_notified_at: string | null;
  created_at: string;
  updated_at: string;
}

const DealerSubscriptionSchema = new Schema<IDealerSubscription>(
  {
    id: { type: String, required: true, unique: true, index: true },
    dealer_id: { type: String, required: true, unique: true, index: true },
    package_name: { type: String, required: true, index: true },
    billing_period: { type: String, enum: ['monthly', 'yearly'], default: 'monthly', index: true },
    expires_at: { type: String, default: null, index: true },
    is_active: { type: Boolean, default: true },
    notes: { type: String, default: null },
    expiry_notified_at: { type: String, default: null },
    expiry_soon_notified_at: { type: String, default: null },
    created_at: { type: String, default: () => new Date().toISOString() },
    updated_at: { type: String, default: () => new Date().toISOString() },
  },
  { versionKey: false, collection: 'dealer_subscriptions' },
);

DealerSubscriptionSchema.pre('save', function (next) {
  this.updated_at = new Date().toISOString();
  next();
});

export const DealerSubscription =
  (mongoose.models['DealerSubscription'] as mongoose.Model<IDealerSubscription>) ||
  mongoose.model<IDealerSubscription>('DealerSubscription', DealerSubscriptionSchema);