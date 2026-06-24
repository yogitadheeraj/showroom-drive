import mongoose, { Document, Schema } from 'mongoose';

export interface ILocationNew extends Document {
  _id: mongoose.Types.ObjectId;
  orgId: mongoose.Types.ObjectId;
  businessUnitId: mongoose.Types.ObjectId;
  salesOfficeId: mongoose.Types.ObjectId;
  plantId: mongoose.Types.ObjectId;
  name: string;
  locationCode: string;
  externalLocationId?: string | null;
  locationType: 'SHOWROOM' | 'TEST_DRIVE_AREA' | 'STOCK_AREA' | 'DELIVERY_AREA' | 'SERVICE_AREA';
  address: string;
  latitude?: number | null;
  longitude?: number | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const LocationNewSchema = new Schema<ILocationNew>(
  {
    _id: { type: String, required: true, unique: true, index: true },
    orgId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    businessUnitId: { type: Schema.Types.ObjectId, ref: 'BusinessUnit', required: true, index: true },
    salesOfficeId: { type: Schema.Types.ObjectId, ref: 'SalesOffice', required: true, index: true },
    plantId: { type: Schema.Types.ObjectId, ref: 'Plant', required: true, index: true },
    name: { type: String, required: true },
    locationCode: { type: String, required: true, unique: true, index: true },
    externalLocationId: { type: String, default: null, sparse: true, unique: true, index: true },
    locationType: { type: String, enum: ['SHOWROOM', 'TEST_DRIVE_AREA', 'STOCK_AREA', 'DELIVERY_AREA', 'SERVICE_AREA'], required: true },
    address: { type: String, required: true },
    latitude: { type: Number, default: null },
    longitude: { type: Number, default: null },
    isActive: { type: Boolean, default: true, index: true },
  },
  { versionKey: false, timestamps: true, collection: 'locations_new' }
);

// Composite index
LocationNewSchema.index({ orgId: 1, businessUnitId: 1, salesOfficeId: 1, plantId: 1 });

export const LocationNew = mongoose.models['LocationNew'] as mongoose.Model<ILocationNew> || 
  mongoose.model<ILocationNew>('LocationNew', LocationNewSchema);
