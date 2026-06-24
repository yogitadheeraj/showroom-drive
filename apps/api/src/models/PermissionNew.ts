import mongoose, { Document, Schema } from 'mongoose';

export interface IPermission extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  code: string;
  module: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const PermissionSchema = new Schema<IPermission>(
  {
    name: { type: String, required: true },
    code: { type: String, required: true, unique: true, index: true },
    module: { type: String, required: true, index: true },
    description: { type: String, default: null },
  },
  { versionKey: false, timestamps: true, collection: 'permissions_new' }
);

export const PermissionNew = mongoose.models['PermissionNew'] as mongoose.Model<IPermission> || 
  mongoose.model<IPermission>('PermissionNew', PermissionSchema);
