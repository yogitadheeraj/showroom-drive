import mongoose, { Document, Schema } from 'mongoose';

export interface IOrganization extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  code: string;
  type: 'GROUP' | 'ENTITY' | 'COMPANY';
  country: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const OrganizationSchema = new Schema<IOrganization>(
  {
    name: { type: String, required: true },
    code: { type: String, required: true, unique: true, index: true },
    type: { type: String, enum: ['GROUP', 'ENTITY', 'COMPANY'], default: 'ENTITY' },
    country: { type: String, required: true },
    isActive: { type: Boolean, default: true, index: true },
  },
  { versionKey: false, timestamps: true, collection: 'organizations' }
);

export const Organization = mongoose.models['Organization'] as mongoose.Model<IOrganization> || 
  mongoose.model<IOrganization>('Organization', OrganizationSchema);
