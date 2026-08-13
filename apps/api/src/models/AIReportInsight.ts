import mongoose, { Document, Schema } from 'mongoose';

export interface IAIReportInsight extends Document {
  id: string;
  location_id: string;
  dealer_id: string | null;
  report_date: string;
  report_type: string;
  summary: string;
  key_points: string[];
  risks: string[];
  recommendations: string[];
  kpis: Record<string, unknown>;
  generated_by: 'rules' | 'llm';
  model_name: string | null;
  created_at: string;
  updated_at: string;
}

const AIReportInsightSchema = new Schema<IAIReportInsight>(
  {
    id: { type: String, required: true, unique: true, index: true },
    location_id: { type: String, required: true, index: true },
    dealer_id: { type: String, default: null, index: true },
    report_date: { type: String, required: true, index: true },
    report_type: { type: String, required: true, default: 'daily_ops', index: true },
    summary: { type: String, required: true },
    key_points: { type: [String], default: [] },
    risks: { type: [String], default: [] },
    recommendations: { type: [String], default: [] },
    kpis: { type: Schema.Types.Mixed, default: {} },
    generated_by: { type: String, enum: ['rules', 'llm'], default: 'rules' },
    model_name: { type: String, default: null },
    created_at: { type: String, default: () => new Date().toISOString() },
    updated_at: { type: String, default: () => new Date().toISOString() },
  },
  { versionKey: false, collection: 'ai_report_insights' },
);

AIReportInsightSchema.index({ location_id: 1, report_date: 1, report_type: 1 }, { unique: true });

export const AIReportInsight =
  (mongoose.models['AIReportInsight'] as mongoose.Model<IAIReportInsight>) ||
  mongoose.model<IAIReportInsight>('AIReportInsight', AIReportInsightSchema);
