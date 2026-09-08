import mongoose, { Schema } from 'mongoose';

export interface ITradeInRequest {
  id: string;
  customer_name: string;
  phone: string;
  email?: string;
  preferred_brand: string;
  preferred_model?: string;
  current_vehicle: string;
  current_year?: string;
  current_mileage?: string;
  condition?: string;
  expected_offer?: string;
  notes?: string;
  status?: string;
  dealer_id?: string | null;
  location_id?: string | null;
  created_at?: string;
  updated_at?: string;
}

const TradeInRequestSchema = new Schema<ITradeInRequest>(
  {
    id: { type: String, required: true, index: true, unique: true },
    customer_name: { type: String, required: true },
    phone: { type: String, required: true },
    email: { type: String, default: '' },
    preferred_brand: { type: String, default: 'BMW' },
    preferred_model: { type: String, default: '' },
    current_vehicle: { type: String, required: true },
    current_year: { type: String, default: '' },
    current_mileage: { type: String, default: '' },
    condition: { type: String, default: 'Good' },
    expected_offer: { type: String, default: '' },
    notes: { type: String, default: '' },
    status: { type: String, default: 'New enquiry' },
    dealer_id: { type: String, default: null },
    location_id: { type: String, default: null },
    created_at: { type: String, default: () => new Date().toISOString() },
    updated_at: { type: String, default: () => new Date().toISOString() },
  },
  { versionKey: false },
);

export const TradeInRequest = mongoose.models.TradeInRequest
  || mongoose.model<ITradeInRequest>('TradeInRequest', TradeInRequestSchema, 'trade_in_requests');
