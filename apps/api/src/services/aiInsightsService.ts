import { randomUUID } from 'node:crypto';
import { env } from '../config/env.js';
import { AIReportInsight } from '../models/AIReportInsight.js';
import { Communication } from '../models/Communication.js';
import { Location } from '../models/Location.js';
import { StaffActivityEvent } from '../models/StaffActivityEvent.js';
import { TestDrive } from '../models/TestDrive.js';

type DailyOpsMetrics = {
  totalTestDrives: number;
  completedTestDrives: number;
  noShowTestDrives: number;
  inProgressTestDrives: number;
  scheduledTestDrives: number;
  completionRatePct: number;
  noShowRatePct: number;
  pendingEnquiries: number;
  totalActivityEvents: number;
  topActivityEvents: Array<{ eventType: string; count: number }>;
};

type InsightPayload = {
  summary: string;
  key_points: string[];
  risks: string[];
  recommendations: string[];
  generated_by: 'rules' | 'llm';
  model_name: string | null;
};

function toDateOnly(value?: string) {
  return value || new Date().toISOString().split('T')[0];
}

function pct(numerator: number, denominator: number) {
  if (!denominator) return 0;
  return Math.round((numerator / denominator) * 10000) / 100;
}

async function buildDailyOpsMetrics(locationId: string, reportDate: string): Promise<DailyOpsMetrics> {
  const [drives, events] = await Promise.all([
    TestDrive.find({ location_id: locationId }).lean(),
    StaffActivityEvent.find({
      location_id: locationId,
      happened_at: { $gte: `${reportDate}T00:00:00`, $lte: `${reportDate}T23:59:59` },
    }).lean(),
  ]);

  const totalTestDrives = drives.length;
  const completedTestDrives = drives.filter((d: any) => d.status === 'completed').length;
  const noShowTestDrives = drives.filter((d: any) => d.status === 'no_show').length;
  const inProgressTestDrives = drives.filter((d: any) => d.status === 'in_progress').length;
  const scheduledTestDrives = drives.filter((d: any) => ['scheduled', 'confirmed', 'show'].includes(d.status)).length;

  const customerIds = Array.from(new Set(drives.map((d: any) => d.customer_id).filter(Boolean)));
  const pendingEnquiries = customerIds.length > 0
    ? await Communication.countDocuments({
        customer_id: { $in: customerIds },
        status: 'pending',
        purpose: { $in: ['custom', 'follow_up'] },
      })
    : 0;

  const eventCounts: Record<string, number> = {};
  for (const event of events) {
    const eventType = String((event as any).event_type || 'unknown');
    eventCounts[eventType] = (eventCounts[eventType] || 0) + 1;
  }

  const topActivityEvents = Object.entries(eventCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([eventType, count]) => ({ eventType, count }));

  return {
    totalTestDrives,
    completedTestDrives,
    noShowTestDrives,
    inProgressTestDrives,
    scheduledTestDrives,
    completionRatePct: pct(completedTestDrives, totalTestDrives),
    noShowRatePct: pct(noShowTestDrives, totalTestDrives),
    pendingEnquiries: Number(pendingEnquiries || 0),
    totalActivityEvents: events.length,
    topActivityEvents,
  };
}

function buildRuleBasedInsight(metrics: DailyOpsMetrics): InsightPayload {
  const keyPoints: string[] = [
    `Total test drives: ${metrics.totalTestDrives}`,
    `Completed drives: ${metrics.completedTestDrives} (${metrics.completionRatePct}%)`,
    `No-shows: ${metrics.noShowTestDrives} (${metrics.noShowRatePct}%)`,
    `Pending enquiries: ${metrics.pendingEnquiries}`,
  ];

  const risks: string[] = [];
  const recommendations: string[] = [];

  if (metrics.noShowRatePct >= 20) {
    risks.push('High no-show rate observed for the day.');
    recommendations.push('Enable pre-drive WhatsApp confirmation at T-4h and T-1h for high-risk customers.');
  }

  if (metrics.pendingEnquiries >= 10) {
    risks.push('Backlog risk in pending enquiries can reduce conversion speed.');
    recommendations.push('Auto-assign pending enquiries to available sales staff and set 30-minute SLA reminders.');
  }

  if (metrics.completionRatePct < 50 && metrics.totalTestDrives >= 8) {
    risks.push('Completion rate is below expected baseline for current booking volume.');
    recommendations.push('Review slot quality and customer readiness checks before final scheduling.');
  }

  if (recommendations.length === 0) {
    recommendations.push('Maintain current cadence and monitor no-show trend for next 3 days.');
  }

  const summary =
    `Daily operations summary: ${metrics.completedTestDrives}/${metrics.totalTestDrives} drives completed ` +
    `(${metrics.completionRatePct}%), with ${metrics.noShowTestDrives} no-shows and ` +
    `${metrics.pendingEnquiries} pending enquiries.`;

  return {
    summary,
    key_points: keyPoints,
    risks,
    recommendations,
    generated_by: 'rules',
    model_name: null,
  };
}

async function tryLLMInsight(metrics: DailyOpsMetrics, ruleInsight: InsightPayload): Promise<InsightPayload | null> {
  if (!env.aiApiKey) return null;

  const prompt = {
    instruction:
      'You are an operations analyst for an automotive dealership. Produce concise JSON with keys: summary, key_points, risks, recommendations. Keep each list length 3-6 and practical.',
    metrics,
    baseline: ruleInsight,
  };

  try {
    const response = await fetch(`${env.aiApiBaseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.aiApiKey}`,
      },
      body: JSON.stringify({
        model: env.aiModel,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: 'Respond with valid JSON only.' },
          { role: 'user', content: JSON.stringify(prompt) },
        ],
        temperature: 0.2,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      console.warn('[aiInsights] LLM call failed:', response.status, text);
      return null;
    }

    const data = (await response.json()) as any;
    const rawContent = data?.choices?.[0]?.message?.content;
    if (!rawContent || typeof rawContent !== 'string') return null;

    const parsed = JSON.parse(rawContent) as Partial<InsightPayload>;
    if (!parsed.summary || !Array.isArray(parsed.key_points) || !Array.isArray(parsed.recommendations)) {
      return null;
    }

    return {
      summary: String(parsed.summary),
      key_points: parsed.key_points.map((x) => String(x)).slice(0, 8),
      risks: Array.isArray(parsed.risks) ? parsed.risks.map((x) => String(x)).slice(0, 8) : [],
      recommendations: parsed.recommendations.map((x) => String(x)).slice(0, 8),
      generated_by: 'llm',
      model_name: env.aiModel,
    };
  } catch (error) {
    console.warn('[aiInsights] LLM parsing/call failed:', error);
    return null;
  }
}

export async function generateDailyAIInsights(options: {
  reportDate?: string;
  locationIds?: string[];
  forceRegenerate?: boolean;
} = {}) {
  const reportDate = toDateOnly(options.reportDate);

  const locations = options.locationIds?.length
    ? await Location.find({ id: { $in: options.locationIds }, is_active: true }, { id: 1, dealer_id: 1, name: 1 }).lean()
    : await Location.find({ is_active: true }, { id: 1, dealer_id: 1, name: 1 }).lean();

  let generated = 0;
  const errors: string[] = [];

  for (const location of locations) {
    const locationId = (location as any).id as string;
    if (!locationId) continue;

    try {
      if (!options.forceRegenerate) {
        const existing = await AIReportInsight.findOne({
          location_id: locationId,
          report_date: reportDate,
          report_type: 'daily_ops',
        }).lean();

        if (existing) continue;
      }

      const metrics = await buildDailyOpsMetrics(locationId, reportDate);
      const ruleInsight = buildRuleBasedInsight(metrics);
      const llmInsight = await tryLLMInsight(metrics, ruleInsight);
      const finalInsight = llmInsight || ruleInsight;

      await AIReportInsight.findOneAndUpdate(
        { location_id: locationId, report_date: reportDate, report_type: 'daily_ops' },
        {
          $setOnInsert: { id: randomUUID(), created_at: new Date().toISOString() },
          $set: {
            dealer_id: (location as any).dealer_id || null,
            summary: finalInsight.summary,
            key_points: finalInsight.key_points,
            risks: finalInsight.risks,
            recommendations: finalInsight.recommendations,
            kpis: metrics,
            generated_by: finalInsight.generated_by,
            model_name: finalInsight.model_name,
            updated_at: new Date().toISOString(),
          },
        },
        { upsert: true },
      );

      generated++;
    } catch (error) {
      errors.push(`${locationId}: ${(error as Error).message}`);
    }
  }

  return { reportDate, generated, errors };
}

export async function listAIInsights(filters: {
  location_id?: string;
  dealer_id?: string;
  report_date?: string;
  report_month?: string;
  scope?: 'daily' | 'month' | 'all';
  limit?: number;
} = {}) {
  const query: Record<string, unknown> = {};
  if (filters.location_id) query.location_id = filters.location_id;
  if (filters.dealer_id) query.dealer_id = filters.dealer_id;

  const scope = filters.scope || (filters.report_month ? 'month' : filters.report_date ? 'daily' : 'all');

  if (scope === 'daily' && filters.report_date) {
    query.report_date = filters.report_date;
  }

  if (scope === 'month' && filters.report_month) {
    query.report_date = {
      $gte: `${filters.report_month}-01`,
      $lte: `${filters.report_month}-31`,
    };
  }

  const limit = Math.max(1, Math.min(500, Number(filters.limit) || 100));

  const docs = await AIReportInsight.find(query)
    .sort({ report_date: -1, created_at: -1 })
    .limit(limit)
    .lean();

  const locationIds = Array.from(new Set(docs.map((doc: any) => String(doc.location_id || '')).filter(Boolean)));
  const locations = locationIds.length
    ? await Location.find({ id: { $in: locationIds } }, { id: 1, name: 1 }).lean()
    : [];
  const locationNameById = new Map(
    locations.map((location: any) => [String(location.id), String(location.name || '')]),
  );

  return docs.map((doc) => {
    const o = { ...doc } as any;
    o.location_name = locationNameById.get(String(o.location_id || '')) || null;
    delete o._id;
    return o;
  });
}
