import mongoose, { Document, Schema } from 'mongoose';

export interface IUserRoleAssignment extends Document {
  _id: mongoose.Types.ObjectId;
  userId: string;
  roleId: mongoose.Types.ObjectId;
  orgId: mongoose.Types.ObjectId | null;
  businessUnitId?: mongoose.Types.ObjectId | null;
  brandId?: mongoose.Types.ObjectId | null;
  salesOfficeId?: mongoose.Types.ObjectId | null;
  plantId?: mongoose.Types.ObjectId | null;
  locationId?: mongoose.Types.ObjectId | null;
  isPrimary: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const UserRoleAssignmentSchema = new Schema<IUserRoleAssignment>(
  {
    userId: { type: String, required: true, index: true },
    roleId: { type: Schema.Types.ObjectId, ref: 'RoleNew', required: true, index: true },
    orgId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    businessUnitId: { type: Schema.Types.ObjectId, ref: 'BusinessUnit', default: null, index: true },
    brandId: { type: Schema.Types.ObjectId, ref: 'BrandNew', default: null, index: true },
    salesOfficeId: { type: Schema.Types.ObjectId, ref: 'SalesOffice', default: null, index: true },
    plantId: { type: Schema.Types.ObjectId, ref: 'Plant', default: null, index: true },
    locationId: { type: Schema.Types.ObjectId, ref: 'LocationNew', default: null, index: true },
    isPrimary: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true, index: true },
  },
  { versionKey: false, timestamps: true, collection: 'user_role_assignments_new' }
);

// Composite indexes
UserRoleAssignmentSchema.index({ userId: 1, isActive: 1 });
UserRoleAssignmentSchema.index({ orgId: 1, businessUnitId: 1, brandId: 1, salesOfficeId: 1, plantId: 1, locationId: 1 });

export const UserRoleAssignmentNew = mongoose.models['UserRoleAssignmentNew'] as mongoose.Model<IUserRoleAssignment> || 
  mongoose.model<IUserRoleAssignment>('UserRoleAssignmentNew', UserRoleAssignmentSchema);
