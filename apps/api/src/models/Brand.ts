import mongoose, { Document, Schema } from 'mongoose';

export interface IBrand extends Document {
  id: string;
  dealer_id: string | null;
  entity_id: string | null;
  name: string;
  description: string | null;
  logo_url: string | null;
  meta_title: string | null;
  meta_description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

const BrandSchema = new Schema<IBrand>(
  {
    id: { type: String, required: true, unique: true, index: true },
    dealer_id: { type: String, default: null, index: true },
    entity_id: { type: String, default: null, index: true },
    name: { type: String, required: true },
    description: { type: String, default: null },
    logo_url: { type: String, default: null },
    meta_title: { type: String, default: null },
    meta_description: { type: String, default: null },
    is_active: { type: Boolean, default: true },
    created_at: { type: String, default: () => new Date().toISOString() },
    updated_at: { type: String, default: () => new Date().toISOString() },
  },
  { versionKey: false, collection: 'brands' },
);

BrandSchema.pre('save', function (next) {
  this.updated_at = new Date().toISOString();
  next();
});

export const Brand = mongoose.models['Brand'] as mongoose.Model<IBrand> || mongoose.model<IBrand>('Brand', BrandSchema);
