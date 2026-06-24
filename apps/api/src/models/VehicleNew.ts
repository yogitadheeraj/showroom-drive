import mongoose, { Document, Schema } from 'mongoose';

export interface IVehicleNew extends Document {
  _id: mongoose.Types.ObjectId;
  orgId: mongoose.Types.ObjectId;
  businessUnitId: mongoose.Types.ObjectId;
  brandId: mongoose.Types.ObjectId;
  salesOfficeId: mongoose.Types.ObjectId | null;
  plantId: mongoose.Types.ObjectId | null;
  locationId: mongoose.Types.ObjectId | null;
  vehicleCode: string;
  vin?: string | null;
  stockNumber?: string | null;
  model: string;
  variant: string;
  year: number;
  color: string;
  condition: 'NEW' | 'USED';
  stockType: 'NEW_STOCK' | 'PRE_OWNED' | 'DEMO' | 'CERTIFIED_PRE_OWNED';
  status: 'AVAILABLE' | 'RESERVED' | 'SOLD' | 'IN_TEST_DRIVE' | 'BLOCKED';
  price: number;
  currency: string;
  mileage?: number | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const VehicleNewSchema = new Schema<IVehicleNew>(
  {
    orgId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    businessUnitId: { type: Schema.Types.ObjectId, ref: 'BusinessUnit', required: true, index: true },
    brandId: { type: Schema.Types.ObjectId, ref: 'BrandNew', required: true, index: true },
    salesOfficeId: { type: Schema.Types.ObjectId, ref: 'SalesOffice', default: null, index: true },
    plantId: { type: Schema.Types.ObjectId, ref: 'Plant', default: null, index: true },
    locationId: { type: Schema.Types.ObjectId, ref: 'LocationNew', default: null, index: true },
    vehicleCode: { type: String, required: true },
    vin: { type: String, default: null, sparse: true, unique: true, index: true },
    stockNumber: { type: String, default: null, sparse: true, unique: true, index: true },
    model: { type: String, required: true },
    variant: { type: String, required: true },
    year: { type: Number, required: true },
    color: { type: String, required: true },
    condition: { type: String, enum: ['NEW', 'USED'], required: true },
    stockType: { type: String, enum: ['NEW_STOCK', 'PRE_OWNED', 'DEMO', 'CERTIFIED_PRE_OWNED'], required: true },
    status: { type: String, enum: ['AVAILABLE', 'RESERVED', 'SOLD', 'IN_TEST_DRIVE', 'BLOCKED'], default: 'AVAILABLE', index: true },
    price: { type: Number, required: true },
    currency: { type: String, default: 'AED' },
    mileage: { type: Number, default: null },
    isActive: { type: Boolean, default: true, index: true },
  },
  { versionKey: false, timestamps: true, collection: 'vehicles_new' }
);

// Composite indexes
VehicleNewSchema.index({ orgId: 1, businessUnitId: 1, brandId: 1, condition: 1 });
VehicleNewSchema.index({ salesOfficeId: 1, plantId: 1, locationId: 1 });

export const VehicleNew = mongoose.models['VehicleNew'] as mongoose.Model<IVehicleNew> || 
  mongoose.model<IVehicleNew>('VehicleNew', VehicleNewSchema);
