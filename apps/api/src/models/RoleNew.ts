import mongoose, { Document, Schema } from 'mongoose';

export interface IRole extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  code: 'ENTITY_ADMIN' | 'DEALER_ADMIN' | 'SALES_ADMIN' | 'SALES_PERSON' | 'GRO' | 'SECURITY';
  roleLevel: 'ORG' | 'BUSINESS_UNIT' | 'LOCATION' | 'SELF';
  description: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const RoleSchema = new Schema<IRole>(
  {
    name: { type: String, required: true },
    code: { 
      type: String, 
      required: true, 
      unique: true, 
      index: true,
      enum: ['ENTITY_ADMIN', 'DEALER_ADMIN', 'SALES_ADMIN', 'SALES_PERSON', 'GRO', 'SECURITY']
    },
    roleLevel: { type: String, enum: ['ORG', 'BUSINESS_UNIT', 'LOCATION', 'SELF'], required: true },
    description: { type: String, default: null },
    isActive: { type: Boolean, default: true, index: true },
  },
  { versionKey: false, timestamps: true, collection: 'roles_new' }
);

export const RoleNew = mongoose.models['RoleNew'] as mongoose.Model<IRole> || 
  mongoose.model<IRole>('RoleNew', RoleSchema);
