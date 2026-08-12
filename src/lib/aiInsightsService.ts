import { apiGet, apiPost } from '@/lib/apiClient';

export interface AIReportInsight {
  id: string;
  location_id: string;
  location_name?: string | null;
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

export async function listAIInsights(params: {
  location_id?: string;
  dealer_id?: string;
  report_date?: string;
  report_month?: string;
  scope?: 'daily' | 'month' | 'all';
  limit?: number;
} = {}) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') search.set(k, String(v));
  });

  return apiGet<AIReportInsight[]>(`/api/ai/reports?${search.toString()}`);
}

export async function generateAIInsights(payload: {
  reportDate?: string;
  locationIds?: string[];
  forceRegenerate?: boolean;
} = {}) {
  return apiPost<{ reportDate: string; generated: number; errors: string[] }>('/api/ai/reports/generate', payload as Record<string, unknown>);
}
