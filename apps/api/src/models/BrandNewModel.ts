import mongoose, { Document, Schema } from 'mongoose';

export interface IBrandNew extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  code: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const BrandNewSchema = new Schema<IBrandNew>(
  {
    name: { type: String, required: true },
    code: { type: String, required: true, unique: true, index: true },
    isActive: { type: Boolean, default: true, index: true },
  },
  { versionKey: false, timestamps: true, collection: 'brands_new' }
);

export const BrandNew = mongoose.models['BrandNew'] as mongoose.Model<IBrandNew> || 
  mongoose.model<IBrandNew>('BrandNew', BrandNewSchema);
