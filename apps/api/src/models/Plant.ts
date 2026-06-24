import mongoose, { Document, Schema } from 'mongoose';

export interface IPlant extends Document {
  _id: mongoose.Types.ObjectId;
  orgId: mongoose.Types.ObjectId;
  businessUnitId: mongoose.Types.ObjectId;
  salesOfficeId: mongoose.Types.ObjectId;
  name: string;
  plantCode: string;
  externalPlantId?: string | null;
  plantType: 'SHOWROOM' | 'STOCKYARD' | 'WORKSHOP' | 'BRANCH';
  country: string;
  city: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const PlantSchema = new Schema<IPlant>(
  {
    orgId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    businessUnitId: { type: Schema.Types.ObjectId, ref: 'BusinessUnit', required: true, index: true },
    salesOfficeId: { type: Schema.Types.ObjectId, ref: 'SalesOffice', required: true, index: true },
    name: { type: String, required: true },
    plantCode: { type: String, required: true, unique: true, index: true },
    externalPlantId: { type: String, default: null, sparse: true, unique: true, index: true },
    plantType: { type: String, enum: ['SHOWROOM', 'STOCKYARD', 'WORKSHOP', 'BRANCH'], required: true },
    country: { type: String, required: true },
    city: { type: String, required: true },
    isActive: { type: Boolean, default: true, index: true },
  },
  { versionKey: false, timestamps: true, collection: 'plants' }
);

// Composite index
PlantSchema.index({ orgId: 1, businessUnitId: 1, salesOfficeId: 1 });

export const Plant = mongoose.models['Plant'] as mongoose.Model<IPlant> || 
  mongoose.model<IPlant>('Plant', PlantSchema);
