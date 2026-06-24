import mongoose, { Document, Schema } from 'mongoose';

export interface ITestDriveNew extends Document {
  _id: mongoose.Types.ObjectId;
  orgId: mongoose.Types.ObjectId;
  businessUnitId: mongoose.Types.ObjectId;
  brandId: mongoose.Types.ObjectId;
  salesOfficeId: mongoose.Types.ObjectId | null;
  plantId: mongoose.Types.ObjectId | null;
  locationId: mongoose.Types.ObjectId | null;
  vehicleId: mongoose.Types.ObjectId;
  leadId: mongoose.Types.ObjectId | null;
  customerId: string | null;
  assignedSalesPersonId?: string | null;
  groId?: string | null;
  securityId?: string | null;
  scheduledDate: Date;
  scheduledTime: string;
  status: 'REQUESTED' | 'CONFIRMED' | 'CUSTOMER_ARRIVED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';
  googleCalendarEventId?: string | null;
  remarks?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const TestDriveNewSchema = new Schema<ITestDriveNew>(
  {
    orgId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    businessUnitId: { type: Schema.Types.ObjectId, ref: 'BusinessUnit', required: true, index: true },
    brandId: { type: Schema.Types.ObjectId, ref: 'BrandNew', required: true, index: true },
    salesOfficeId: { type: Schema.Types.ObjectId, ref: 'SalesOffice', default: null, index: true },
    plantId: { type: Schema.Types.ObjectId, ref: 'Plant', default: null, index: true },
    locationId: { type: Schema.Types.ObjectId, ref: 'LocationNew', default: null, index: true },
    vehicleId: { type: Schema.Types.ObjectId, ref: 'VehicleNew', required: true, index: true },
    leadId: { type: Schema.Types.ObjectId, ref: 'LeadNew', default: null },
    customerId: { type: String, default: null, index: true },
    assignedSalesPersonId: { type: String, default: null, index: true },
    groId: { type: String, default: null, index: true },
    securityId: { type: String, default: null, index: true },
    scheduledDate: { type: Date, required: true, index: true },
    scheduledTime: { type: String, required: true },
    status: { type: String, enum: ['REQUESTED', 'CONFIRMED', 'CUSTOMER_ARRIVED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'NO_SHOW'], default: 'REQUESTED', index: true },
    googleCalendarEventId: { type: String, default: null },
    remarks: { type: String, default: null },
  },
  { versionKey: false, timestamps: true, collection: 'test_drives_new' }
);

export const TestDriveNew = mongoose.models['TestDriveNew'] as mongoose.Model<ITestDriveNew> || 
  mongoose.model<ITestDriveNew>('TestDriveNew', TestDriveNewSchema);
