import mongoose, { Document, Schema } from 'mongoose';

export interface IChatMessage {
  role: 'user' | 'assistant' | 'tool_result';
  content: string;
  tool_call_id?: string | null;
  created_at: string;
}

export interface IAgentConversation extends Document {
  id: string;
  user_id: string;
  location_id: string | null;
  dealer_id: string | null;
  role: string | null;
  title: string | null;
  messages: IChatMessage[];
  created_at: string;
  updated_at: string;
}

const ChatMessageSchema = new Schema<IChatMessage>(
  {
    role: { type: String, enum: ['user', 'assistant', 'tool_result'], required: true },
    content: { type: String, required: true },
    tool_call_id: { type: String, default: null },
    created_at: { type: String, default: () => new Date().toISOString() },
  },
  { _id: false },
);

const AgentConversationSchema = new Schema<IAgentConversation>(
  {
    id: { type: String, required: true, unique: true, index: true },
    user_id: { type: String, required: true, index: true },
    location_id: { type: String, default: null, index: true },
    dealer_id: { type: String, default: null },
    role: { type: String, default: null },
    title: { type: String, default: null },
    messages: { type: [ChatMessageSchema], default: [] },
    created_at: { type: String, default: () => new Date().toISOString() },
    updated_at: { type: String, default: () => new Date().toISOString() },
  },
  { versionKey: false, collection: 'agent_conversations' },
);

AgentConversationSchema.index({ user_id: 1, updated_at: -1 });

export const AgentConversation =
  (mongoose.models['AgentConversation'] as mongoose.Model<IAgentConversation>) ||
  mongoose.model<IAgentConversation>('AgentConversation', AgentConversationSchema);
