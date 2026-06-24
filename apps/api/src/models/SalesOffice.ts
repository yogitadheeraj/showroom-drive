import mongoose, { Document, Schema } from 'mongoose';

export interface ISalesOffice extends Document {
  _id: mongoose.Types.ObjectId;
  orgId: mongoose.Types.ObjectId;
  businessUnitId: mongoose.Types.ObjectId;
  name: string;
  salesOfficeCode: string;
  externalSalesOfficeId?: string | null;
  country: string;
  city: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const SalesOfficeSchema = new Schema<ISalesOffice>(
  {
    orgId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    businessUnitId: { type: Schema.Types.ObjectId, ref: 'BusinessUnit', required: true, index: true },
    name: { type: String, required: true },
    salesOfficeCode: { type: String, required: true, unique: true, index: true },
    externalSalesOfficeId: { type: String, default: null, sparse: true, unique: true, index: true },
    country: { type: String, required: true },
    city: { type: String, required: true },
    isActive: { type: Boolean, default: true, index: true },
  },
  { versionKey: false, timestamps: true, collection: 'sales_offices' }
);

// Composite index
SalesOfficeSchema.index({ orgId: 1, businessUnitId: 1 });

export const SalesOffice = mongoose.models['SalesOffice'] as mongoose.Model<ISalesOffice> || 
  mongoose.model<ISalesOffice>('SalesOffice', SalesOfficeSchema);
