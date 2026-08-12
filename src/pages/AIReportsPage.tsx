import { useEffect, useMemo, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useDealerContext } from '@/hooks/useDealerContext';
import { generateAIInsights, listAIInsights, type AIReportInsight } from '@/lib/aiInsightsService';
import { Sparkles, RefreshCw, AlertTriangle, BarChart3, CalendarDays, Building2, Activity } from 'lucide-react';

type InsightScope = 'daily' | 'month' | 'all';

const AIReportsPage = () => {
  const { dealerLocationIds } = useDealerContext();
  const { toast } = useToast();

  const [rows, setRows] = useState<AIReportInsight[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [reportDate, setReportDate] = useState(new Date().toISOString().split('T')[0]);
  const [reportMonth, setReportMonth] = useState(new Date().toISOString().slice(0, 7));
  const [scope, setScope] = useState<InsightScope>('daily');

  const selectedLocationIds = useMemo(
    () => Array.from(new Set((dealerLocationIds || []).filter(Boolean))),
    [dealerLocationIds],
  );

  const aggregate = useMemo(
    () => rows.reduce(
      (acc, row) => {
        const kpis = (row.kpis || {}) as Record<string, unknown>;
        acc.totalRows += 1;
        acc.totalDrives += Number(kpis.totalTestDrives || 0);
        acc.totalPending += Number(kpis.pendingEnquiries || 0);
        acc.totalNoShow += Number(kpis.noShowTestDrives || 0);
        return acc;
      },
      { totalRows: 0, totalDrives: 0, totalPending: 0, totalNoShow: 0 },
    ),
    [rows],
  );

  const fetchRows = async () => {
    setLoading(true);
    try {
      const data = await listAIInsights({
        scope,
        report_date: scope === 'daily' ? reportDate : undefined,
        report_month: scope === 'month' ? reportMonth : undefined,
        limit: 100,
      });
      setRows(data || []);
    } catch (error: any) {
      toast({ title: 'Failed to load AI insights', description: error?.message || 'Please try again.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchRows();
  }, [scope, reportDate, reportMonth]);

  const handleGenerate = async (forceRegenerate = false) => {
    setGenerating(true);
    try {
      const result = await generateAIInsights({
        reportDate,
        locationIds: selectedLocationIds.length > 0 ? selectedLocationIds : undefined,
        forceRegenerate,
      });

      if (result.errors?.length) {
        toast({
          title: `Generated ${result.generated} insights with ${result.errors.length} errors`,
          description: result.errors.slice(0, 2).join(' | '),
          variant: 'destructive',
        });
      } else {
        toast({ title: `Generated ${result.generated} AI insights` });
      }

      await fetchRows();
    } catch (error: any) {
      toast({ title: 'AI insight generation failed', description: error?.message || 'Please try again.', variant: 'destructive' });
    } finally {
      setGenerating(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <Card className="border border-border bg-gradient-to-r from-primary/5 via-background to-info/5">
          <CardContent className="p-5 sm:p-6">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1">
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                  <span className="text-xs font-semibold tracking-wide text-primary">AI OPERATIONS INTELLIGENCE</span>
                </div>
                <h1 className="mt-3 text-2xl font-heading font-bold text-foreground">AI Daily Insights</h1>
                <p className="text-sm text-muted-foreground mt-1">Professional operational insights powered by test-drive activity and enquiry load.</p>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 w-full lg:w-auto">
                <div className="rounded-xl border bg-card/80 p-3">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Insights</p>
                  <p className="text-xl font-semibold text-foreground">{aggregate.totalRows}</p>
                </div>
                <div className="rounded-xl border bg-card/80 p-3">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Total Drives</p>
                  <p className="text-xl font-semibold text-foreground">{aggregate.totalDrives}</p>
                </div>
                <div className="rounded-xl border bg-card/80 p-3">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Pending Enquiries</p>
                  <p className="text-xl font-semibold text-foreground">{aggregate.totalPending}</p>
                </div>
                <div className="rounded-xl border bg-card/80 p-3">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">No-shows</p>
                  <p className="text-xl font-semibold text-foreground">{aggregate.totalNoShow}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-border">
          <CardContent className="p-4 sm:p-5">
            <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <BarChart3 className="h-4 w-4" />
                <span>Filter and regenerate insights for your selected reporting window.</span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Select value={scope} onValueChange={(value) => setScope(value as InsightScope)}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="View" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="month">Month</SelectItem>
                    <SelectItem value="all">All</SelectItem>
                  </SelectContent>
                </Select>
                {scope === 'daily' ? (
                  <Input type="date" value={reportDate} onChange={(e) => setReportDate(e.target.value)} className="w-[180px]" />
                ) : scope === 'month' ? (
                  <Input type="month" value={reportMonth} onChange={(e) => setReportMonth(e.target.value)} className="w-[180px]" />
                ) : null}
                <Button onClick={() => handleGenerate(false)} loading={generating} loadingText="Generating...">
                  <Sparkles className="h-4 w-4 mr-2" /> Generate
                </Button>
                <Button variant="outline" onClick={() => handleGenerate(true)} disabled={generating}>
                  Force Regenerate
                </Button>
                <Button variant="outline" onClick={fetchRows} disabled={loading}>
                  <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} /> Refresh
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {loading ? (
          <Card>
            <CardContent className="py-14 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                <Activity className="h-6 w-6 text-primary animate-pulse" />
              </div>
              <p className="mt-4 text-sm text-muted-foreground">Loading professional AI insights...</p>
            </CardContent>
          </Card>
        ) : rows.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              No AI insights available for the selected view yet. Click Generate to create a daily insight.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {rows.map((row) => {
              const kpis = row.kpis as Record<string, unknown>;
              return (
                <Card key={row.id} className="border border-border/80 shadow-sm">
                  <CardHeader>
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div className="space-y-2">
                        <CardTitle className="text-base flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-primary" />
                          <span>{row.location_name || row.location_id}</span>
                        </CardTitle>
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="secondary" className="gap-1">
                            <CalendarDays className="h-3 w-3" />
                            {row.report_date}
                          </Badge>
                          <Badge variant="outline">{row.report_type}</Badge>
                        </div>
                      </div>
                      <Badge variant="outline">{row.generated_by === 'llm' ? `AI (${row.model_name || 'model'})` : 'Rule-based'}</Badge>
                    </div>
                    <CardDescription className="pt-1">{row.summary}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-3 sm:grid-cols-4">
                      <div className="rounded-lg border bg-background p-3">
                        <p className="text-xs text-muted-foreground">Total Drives</p>
                        <p className="text-xl font-semibold">{String(kpis.totalTestDrives ?? 0)}</p>
                      </div>
                      <div className="rounded-lg border bg-background p-3">
                        <p className="text-xs text-muted-foreground">Completion %</p>
                        <p className="text-xl font-semibold">{String(kpis.completionRatePct ?? 0)}%</p>
                      </div>
                      <div className="rounded-lg border bg-background p-3">
                        <p className="text-xs text-muted-foreground">No-show %</p>
                        <p className="text-xl font-semibold">{String(kpis.noShowRatePct ?? 0)}%</p>
                      </div>
                      <div className="rounded-lg border bg-background p-3">
                        <p className="text-xs text-muted-foreground">Pending Enquiries</p>
                        <p className="text-xl font-semibold">{String(kpis.pendingEnquiries ?? 0)}</p>
                      </div>
                    </div>

                    <div className="grid gap-4 lg:grid-cols-3">
                      <div>
                        <h3 className="text-sm font-semibold mb-2">Key Points</h3>
                        <ul className="space-y-1 text-sm text-muted-foreground">
                          {row.key_points.map((point, idx) => <li key={idx}>• {point}</li>)}
                        </ul>
                      </div>

                      <div>
                        <h3 className="text-sm font-semibold mb-2 flex items-center gap-1">
                          <AlertTriangle className="h-4 w-4 text-warning" /> Risks
                        </h3>
                        <ul className="space-y-1 text-sm text-muted-foreground">
                          {row.risks.length === 0 ? <li>• No major risks detected.</li> : row.risks.map((risk, idx) => <li key={idx}>• {risk}</li>)}
                        </ul>
                      </div>

                      <div>
                        <h3 className="text-sm font-semibold mb-2">Recommendations</h3>
                        <ul className="space-y-1 text-sm text-muted-foreground">
                          {row.recommendations.map((rec, idx) => <li key={idx}>• {rec}</li>)}
                        </ul>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default AIReportsPage;
