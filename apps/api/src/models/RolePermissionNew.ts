import mongoose, { Document, Schema } from 'mongoose';

export interface IRolePermission extends Document {
  _id: mongoose.Types.ObjectId;
  roleId: mongoose.Types.ObjectId;
  permissionId: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const RolePermissionSchema = new Schema<IRolePermission>(
  {
    roleId: { type: Schema.Types.ObjectId, ref: 'RoleNew', required: true, index: true },
    permissionId: { type: Schema.Types.ObjectId, ref: 'PermissionNew', required: true, index: true },
  },
  { versionKey: false, timestamps: true, collection: 'role_permissions_new' }
);

// Unique index to prevent duplicate role-permission pairs
RolePermissionSchema.index({ roleId: 1, permissionId: 1 }, { unique: true });

export const RolePermissionNew = mongoose.models['RolePermissionNew'] as mongoose.Model<IRolePermission> || 
  mongoose.model<IRolePermission>('RolePermissionNew', RolePermissionSchema);
