import mongoose, { Document, Schema } from 'mongoose';

export type DealerSubscriptionRequestStatus = 'pending' | 'approved' | 'rejected';

export interface IDealerSubscriptionRequest extends Document {
  id: string;
  dealer_id: string;
  requested_by_uid: string;
  requested_by_email: string | null;
  requested_by_role: string;
  current_package_name: string;
  current_billing_period: 'monthly' | 'yearly';
  requested_package_name: string;
  requested_billing_period: 'monthly' | 'yearly';
  note: string | null;
  status: DealerSubscriptionRequestStatus;
  reviewed_by_uid: string | null;
  reviewed_by_email: string | null;
  review_note: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
}

const DealerSubscriptionRequestSchema = new Schema<IDealerSubscriptionRequest>(
  {
    id: { type: String, required: true, unique: true, index: true },
    dealer_id: { type: String, required: true, index: true },
    requested_by_uid: { type: String, required: true, index: true },
    requested_by_email: { type: String, default: null, index: true },
    requested_by_role: { type: String, required: true, index: true },
    current_package_name: { type: String, required: true },
    current_billing_period: { type: String, enum: ['monthly', 'yearly'], required: true, default: 'monthly' },
    requested_package_name: { type: String, required: true, index: true },
    requested_billing_period: { type: String, enum: ['monthly', 'yearly'], required: true, default: 'monthly' },
    note: { type: String, default: null },
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending', index: true },
    reviewed_by_uid: { type: String, default: null },
    reviewed_by_email: { type: String, default: null, index: true },
    review_note: { type: String, default: null },
    resolved_at: { type: String, default: null },
    created_at: { type: String, default: () => new Date().toISOString() },
    updated_at: { type: String, default: () => new Date().toISOString() },
  },
  { versionKey: false, collection: 'dealer_subscription_requests' },
);

DealerSubscriptionRequestSchema.pre('save', function (next) {
  this.updated_at = new Date().toISOString();
  next();
});

export const DealerSubscriptionRequest =
  (mongoose.models['DealerSubscriptionRequest'] as mongoose.Model<IDealerSubscriptionRequest>) ||
  mongoose.model<IDealerSubscriptionRequest>('DealerSubscriptionRequest', DealerSubscriptionRequestSchema);
