import mongoose, { Document, Schema } from 'mongoose';

export type AppRole =
  | 'superadmin'
  | 'super_admin'
  | 'entity_admin'
  | 'dealer_admin'
  | 'sales_admin'
  | 'branch_admin'
  | 'gro'
  | 'sales'
  | 'sales_person'
  | 'brand_admin'
  | 'brand_branch_admin'
  | 'entity'
  | 'security'
  | 'reporting';

export interface IUserRole extends Document {
  id: string;
  user_id: string;
  role: AppRole;
  entity_id?: string | null;
  brand_id?: string | null;
  location_id?: string | null;
  hierarchy_level?: string | null;
}

const UserRoleSchema = new Schema<IUserRole>(
  {
    id: { type: String, required: true, unique: true, index: true },
    user_id: { type: String, required: true, unique: true, index: true },
    role: {
      type: String,
      required: true,
      enum: ['superadmin', 'super_admin', 'entity_admin', 'dealer_admin', 'sales_admin', 'branch_admin', 'gro', 'sales', 'sales_person', 'brand_admin', 'brand_branch_admin', 'entity', 'security', 'reporting'],
    },
    entity_id: { type: String, default: null, index: true },
    brand_id: { type: String, default: null, index: true },
    location_id: { type: String, default: null, index: true },
    hierarchy_level: { type: String, default: null },
  },
  { versionKey: false, collection: 'user_roles' },
);

export const UserRole =
  (mongoose.models['UserRole'] as mongoose.Model<IUserRole>) ||
  mongoose.model<IUserRole>('UserRole', UserRoleSchema);
