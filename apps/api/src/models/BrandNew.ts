import mongoose, { Document, Schema } from 'mongoose';

export interface IBusinessUnit extends Document {
  _id: mongoose.Types.ObjectId;
  orgId: mongoose.Types.ObjectId;
  name: string;
  code: string;
  businessType: 'BRAND_DEALER' | 'USED_CAR_MARKETPLACE';
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const BusinessUnitSchema = new Schema<IBusinessUnit>(
  {
    orgId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    name: { type: String, required: true },
    code: { type: String, required: true },
    businessType: { type: String, enum: ['BRAND_DEALER', 'USED_CAR_MARKETPLACE'], required: true },
    isActive: { type: Boolean, default: true, index: true },
  },
  { versionKey: false, timestamps: true, collection: 'business_units' }
);

// Unique index on orgId + code
BusinessUnitSchema.index({ orgId: 1, code: 1 }, { unique: true });

export const BusinessUnit = mongoose.models['BusinessUnit'] as mongoose.Model<IBusinessUnit> || 
  mongoose.model<IBusinessUnit>('BusinessUnit', BusinessUnitSchema);
