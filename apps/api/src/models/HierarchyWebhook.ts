import mongoose, { Schema, Document } from 'mongoose';

export interface IHierarchyWebhook extends Document {
  // Owner & Scope
  orgId: mongoose.Types.ObjectId;
  businessUnitId?: mongoose.Types.ObjectId;
  createdBy: string; // User ID

  // Webhook Configuration
  name: string;
  description?: string;
  targetUrl: string; // HTTPS URL where events will be posted
  secret: string; // HMAC secret for signing payloads
  events: Array<'hierarchy.entity.created' | 'hierarchy.entity.updated' | 'hierarchy.entity.deleted' | 'hierarchy.role.assigned' | 'hierarchy.batch.completed'>;
  headers?: Record<string, string>; // Custom headers (e.g., Authorization)

  // Retry Configuration
  retryPolicy: {
    maxRetries: number;
    retryDelaySeconds: number; // Base delay between retries
    backoffMultiplier: number; // Exponential backoff factor
  };

  // Filters (optional)
  filters?: {
    entityTypes?: string[]; // Only trigger for specific entity types
    actions?: string[]; // Only trigger for specific actions
  };

  // Status & Metrics
  isActive: boolean;
  lastTriggeredAt?: Date;
  successCount: number; // Total successful deliveries
  failureCount: number; // Total failed deliveries
  lastError?: string; // Last error message

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

const HierarchyWebhookSchema = new Schema<IHierarchyWebhook>(
  {
    orgId: { type: Schema.Types.ObjectId, required: true, index: true },
    businessUnitId: { type: Schema.Types.ObjectId },
    createdBy: { type: String, required: true },
    name: { type: String, required: true },
    description: String,
    targetUrl: { type: String, required: true },
    secret: { type: String, required: true },
    events: [
      {
        type: String,
        enum: [
          'hierarchy.entity.created',
          'hierarchy.entity.updated',
          'hierarchy.entity.deleted',
          'hierarchy.role.assigned',
          'hierarchy.batch.completed',
        ],
      },
    ],
    headers: { type: Schema.Types.Mixed },
    retryPolicy: {
      maxRetries: { type: Number, default: 5 },
      retryDelaySeconds: { type: Number, default: 60 },
      backoffMultiplier: { type: Number, default: 2 },
    },
    filters: {
      entityTypes: [String],
      actions: [String],
    },
    isActive: { type: Boolean, default: true, index: true },
    lastTriggeredAt: Date,
    successCount: { type: Number, default: 0 },
    failureCount: { type: Number, default: 0 },
    lastError: String,
  },
  { timestamps: true }
);

HierarchyWebhookSchema.index({ orgId: 1, isActive: 1 });
HierarchyWebhookSchema.index({ businessUnitId: 1, isActive: 1 });

export default mongoose.model<IHierarchyWebhook>('HierarchyWebhook', HierarchyWebhookSchema);
