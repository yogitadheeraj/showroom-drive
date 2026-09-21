import mongoose, { Document, Schema } from 'mongoose';

export type CarBookingPaymentEventStatus = 'success';

export interface ICarBookingPaymentEvent extends Document {
  id: string;
  booking_id: string;
  location_id: string;
  customer_id: string | null;
  vehicle_id: string | null;
  amount: number;
  currency_code: string;
  payment_mode: 'deposit' | 'full';
  provider: string;
  status: CarBookingPaymentEventStatus;
  payment_link: string | null;
  paid_at: string;
  created_at: string;
  updated_at: string;
}

const CarBookingPaymentEventSchema = new Schema<ICarBookingPaymentEvent>(
  {
    id: { type: String, required: true, unique: true, index: true },
    booking_id: { type: String, required: true, index: true },
    location_id: { type: String, required: true, index: true },
    customer_id: { type: String, default: null, index: true },
    vehicle_id: { type: String, default: null, index: true },
    amount: { type: Number, required: true, default: 0 },
    currency_code: { type: String, required: true, default: 'AED' },
    payment_mode: { type: String, enum: ['deposit', 'full'], required: true, default: 'deposit' },
    provider: { type: String, required: true, default: 'manual' },
    status: { type: String, enum: ['success'], required: true, default: 'success' },
    payment_link: { type: String, default: null },
    paid_at: { type: String, required: true, default: () => new Date().toISOString() },
    created_at: { type: String, default: () => new Date().toISOString() },
    updated_at: { type: String, default: () => new Date().toISOString() },
  },
  { collection: 'car_booking_payment_events', versionKey: false },
);

CarBookingPaymentEventSchema.pre('save', function (next) {
  this.updated_at = new Date().toISOString();
  next();
});

export const CarBookingPaymentEvent =
  (mongoose.models['CarBookingPaymentEvent'] as mongoose.Model<ICarBookingPaymentEvent>) ||
  mongoose.model<ICarBookingPaymentEvent>('CarBookingPaymentEvent', CarBookingPaymentEventSchema);
