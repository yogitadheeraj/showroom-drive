import mongoose, { Document, Schema } from 'mongoose';

export interface IBusinessUnitBrand extends Document {
  _id: mongoose.Types.ObjectId;
  orgId: mongoose.Types.ObjectId;
  businessUnitId: mongoose.Types.ObjectId;
  brandId: mongoose.Types.ObjectId;
  allowedConditions: Array<'NEW' | 'USED'>;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const BusinessUnitBrandSchema = new Schema<IBusinessUnitBrand>(
  {
    orgId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    businessUnitId: { type: Schema.Types.ObjectId, ref: 'BusinessUnit', required: true, index: true },
    brandId: { type: Schema.Types.ObjectId, ref: 'BrandNew', required: true, index: true },
    allowedConditions: { type: [String], enum: ['NEW', 'USED'], required: true },
    isActive: { type: Boolean, default: true, index: true },
  },
  { versionKey: false, timestamps: true, collection: 'business_unit_brands' }
);

// Unique index
BusinessUnitBrandSchema.index({ businessUnitId: 1, brandId: 1 }, { unique: true });

export const BusinessUnitBrand = mongoose.models['BusinessUnitBrand'] as mongoose.Model<IBusinessUnitBrand> || 
  mongoose.model<IBusinessUnitBrand>('BusinessUnitBrand', BusinessUnitBrandSchema);
