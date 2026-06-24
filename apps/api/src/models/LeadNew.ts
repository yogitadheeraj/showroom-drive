import mongoose, { Document, Schema } from 'mongoose';

export interface ILeadNew extends Document {
  _id: mongoose.Types.ObjectId;
  orgId: mongoose.Types.ObjectId;
  businessUnitId: mongoose.Types.ObjectId;
  brandId: mongoose.Types.ObjectId;
  salesOfficeId: mongoose.Types.ObjectId | null;
  plantId: mongoose.Types.ObjectId | null;
  locationId: mongoose.Types.ObjectId | null;
  vehicleId: mongoose.Types.ObjectId | null;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  leadSource: string;
  status: 'NEW' | 'ASSIGNED' | 'CONTACTED' | 'TEST_DRIVE_BOOKED' | 'CLOSED' | 'LOST';
  assignedTo?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const LeadNewSchema = new Schema<ILeadNew>(
  {
    orgId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    businessUnitId: { type: Schema.Types.ObjectId, ref: 'BusinessUnit', required: true, index: true },
    brandId: { type: Schema.Types.ObjectId, ref: 'BrandNew', required: true, index: true },
    salesOfficeId: { type: Schema.Types.ObjectId, ref: 'SalesOffice', default: null, index: true },
    plantId: { type: Schema.Types.ObjectId, ref: 'Plant', default: null, index: true },
    locationId: { type: Schema.Types.ObjectId, ref: 'LocationNew', default: null, index: true },
    vehicleId: { type: Schema.Types.ObjectId, ref: 'VehicleNew', default: null },
    customerName: { type: String, required: true },
    customerEmail: { type: String, required: true, index: true },
    customerPhone: { type: String, required: true },
    leadSource: { type: String, required: true },
    status: { type: String, enum: ['NEW', 'ASSIGNED', 'CONTACTED', 'TEST_DRIVE_BOOKED', 'CLOSED', 'LOST'], default: 'NEW', index: true },
    assignedTo: { type: String, default: null, index: true },
  },
  { versionKey: false, timestamps: true, collection: 'leads_new' }
);

export const LeadNew = mongoose.models['LeadNew'] as mongoose.Model<ILeadNew> || 
  mongoose.model<ILeadNew>('LeadNew', LeadNewSchema);
