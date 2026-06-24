import mongoose, { Schema, Document } from 'mongoose';

export interface IHierarchyWebhookEvent extends Document {
  // Webhook Reference
  webhookId: mongoose.Types.ObjectId;
  orgId: mongoose.Types.ObjectId;

  // Event Details
  eventType: string; // e.g., 'hierarchy.entity.created'
  entityType: string;
  entityId: string;
  action: string; // CREATE, UPDATE, DELETE, ASSIGN, BULK_OPERATION
  data: Record<string, any>; // Full event payload

  // Delivery Attempt Tracking
  attempts: Array<{
    attemptNumber: number;
    timestamp: Date;
    statusCode?: number;
    responseTime?: number; // ms
    error?: string;
    retryAt?: Date;
  }>;

  // Final Status
  status: 'PENDING' | 'DELIVERED' | 'FAILED' | 'ABANDONED';
  finalAttemptAt?: Date;
  finalError?: string;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

const HierarchyWebhookEventSchema = new Schema<IHierarchyWebhookEvent>(
  {
    webhookId: { type: Schema.Types.ObjectId, required: true, index: true },
    orgId: { type: Schema.Types.ObjectId, required: true, index: true },
    eventType: { type: String, required: true },
    entityType: { type: String, required: true },
    entityId: { type: String, required: true },
    action: { type: String, required: true },
    data: { type: Schema.Types.Mixed, required: true },
    attempts: [
      {
        attemptNumber: Number,
        timestamp: Date,
        statusCode: Number,
        responseTime: Number,
        error: String,
        retryAt: Date,
      },
    ],
    status: { type: String, enum: ['PENDING', 'DELIVERED', 'FAILED', 'ABANDONED'], default: 'PENDING', index: true },
    finalAttemptAt: Date,
    finalError: String,
  },
  { timestamps: true }
);

HierarchyWebhookEventSchema.index({ webhookId: 1, status: 1 });
HierarchyWebhookEventSchema.index({ orgId: 1, createdAt: -1 });
HierarchyWebhookEventSchema.index({ status: 1, createdAt: 1 }); // For finding pending/failed events
HierarchyWebhookEventSchema.index({ createdAt: 1 }, { expireAfterSeconds: 2592000 }); // Auto-delete after 30 days

export default mongoose.model<IHierarchyWebhookEvent>('HierarchyWebhookEvent', HierarchyWebhookEventSchema);
