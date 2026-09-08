import { useEffect, useMemo, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { ArrowLeftRight, CarFront, Gauge, Save, ShieldCheck } from 'lucide-react';
import { apiGet, apiPost } from '@/lib/apiClient';
import { useAuth } from '@/hooks/useAuth';
import { useDealerContext } from '@/hooks/useDealerContext';

const STORAGE_KEY = 'trade_in_requests';

type TradeInFormState = {
  customerName: string;
  phone: string;
  email: string;
  preferredBrand: string;
  preferredModel: string;
  currentVehicle: string;
  currentYear: string;
  currentMileage: string;
  condition: string;
  expectedOffer: string;
  notes: string;
  status: string;
};

type TradeInRecord = TradeInFormState & {
  id: string;
  createdAt: string;
};

const initialForm: TradeInFormState = {
  customerName: '',
  phone: '',
  email: '',
  preferredBrand: 'BMW',
  preferredModel: '',
  currentVehicle: '',
  currentYear: '',
  currentMileage: '',
  condition: 'Good',
  expectedOffer: '',
  notes: '',
  status: 'New enquiry',
};

const conditionOptions = ['Excellent', 'Good', 'Fair', 'Needs attention'];
const statusOptions = ['New enquiry', 'Qualified', 'Follow-up', 'Ready for valuation'];

const brandBaseValues: Record<string, number> = {
  BMW: 74000,
  Mercedes: 72000,
  Audi: 69000,
  Porsche: 96000,
  Volkswagen: 52000,
  Toyota: 50000,
  Honda: 47000,
  'Range Rover': 82000,
};

const formatCurrency = (value: number) => `AED ${new Intl.NumberFormat('en-AE', { maximumFractionDigits: 0 }).format(value)}`;

const getTradeInStatusClasses = (status: string) => {
  switch (status) {
    case 'Qualified':
      return 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300';
    case 'Follow-up':
      return 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300';
    case 'Ready for valuation':
      return 'border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900 dark:bg-violet-950/40 dark:text-violet-300';
    case 'New enquiry':
    default:
      return 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-300';
  }
};

const calculateTradeInEstimate = ({
  brand,
  year,
  mileage,
  condition,
}: {
  brand: string;
  year: string;
  mileage: string;
  condition: string;
}) => {
  const baseValue = brandBaseValues[brand] ?? 48000;
  const numericYear = Number(year);
  const currentYear = new Date().getFullYear();
  const age = Math.max(0, currentYear - (Number.isFinite(numericYear) ? numericYear : currentYear));
  const mileageNumber = Number(String(mileage).replace(/[^\d.]/g, '')) || 0;

  const conditionMultiplier = {
    Excellent: 1.12,
    Good: 1,
    Fair: 0.8,
    'Needs attention': 0.62,
  }[condition] ?? 1;

  const ageFactor = Math.max(0.28, 1 - age * 0.09);
  const mileageFactor = Math.max(0.32, 1 - (mileageNumber / 260000) * 0.82);
  const marketAdjustment = 0.62 + (brand === 'Porsche' ? 0.08 : brand === 'Range Rover' ? 0.07 : brand === 'BMW' || brand === 'Mercedes' ? 0.05 : 0.02);

  const estimate = baseValue * ageFactor * conditionMultiplier * mileageFactor * marketAdjustment;
  return Math.max(7000, Math.round(estimate / 500) * 500);
};

const formatDate = (value: string) => {
  if (!value) return '—';
  try {
    return new Intl.DateTimeFormat('en-GB', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(value));
  } catch {
    return value;
  }
};

const normalizeDbTradeInRecord = (row: Record<string, any> | null | undefined): TradeInRecord | null => {
  if (!row) return null;

  const id = String(row.id || row._id || crypto.randomUUID());
  const createdAt = String(row.created_at || row.createdAt || new Date().toISOString());

  return {
    id,
    createdAt,
    customerName: String(row.customer_name ?? row.customerName ?? ''),
    phone: String(row.phone ?? ''),
    email: String(row.email ?? ''),
    preferredBrand: String(row.preferred_brand ?? row.preferredBrand ?? 'BMW'),
    preferredModel: String(row.preferred_model ?? row.preferredModel ?? ''),
    currentVehicle: String(row.current_vehicle ?? row.currentVehicle ?? ''),
    currentYear: String(row.current_year ?? row.currentYear ?? ''),
    currentMileage: String(row.current_mileage ?? row.currentMileage ?? ''),
    condition: String(row.condition ?? 'Good'),
    expectedOffer: String(row.expected_offer ?? row.expectedOffer ?? ''),
    notes: String(row.notes ?? ''),
    status: String(row.status ?? 'New enquiry'),
  };
};

const TradeInPage = () => {
  const { profile } = useAuth();
  const { dealerId } = useDealerContext();
  const [formData, setFormData] = useState<TradeInFormState>(initialForm);
  const [records, setRecords] = useState<TradeInRecord[]>([]);
  const [loadingRecords, setLoadingRecords] = useState(false);

  const saveTradeInRequest = async (payload: Record<string, unknown>) => {
    const result = await apiPost<TradeInRecord>('/api/trade-in-requests', payload);
    return result;
  };

  const estimatedValue = useMemo(
    () => calculateTradeInEstimate({
      brand: formData.preferredBrand,
      year: formData.currentYear,
      mileage: formData.currentMileage,
      condition: formData.condition,
    }),
    [formData.condition, formData.currentMileage, formData.currentYear, formData.preferredBrand],
  );

  useEffect(() => {
    const loadTradeInRecords = async () => {
      setLoadingRecords(true);

      try {
        const filters: Array<{ field: string; op: 'eq'; value: string | null }> = [];

        if (dealerId) {
          filters.push({ field: 'dealer_id', op: 'eq', value: dealerId });
        } else if (profile?.location_id) {
          filters.push({ field: 'location_id', op: 'eq', value: profile.location_id });
        }

        const rows = await apiGet<any[]>('/api/trade-in-requests?limit=20');

        const normalized = (rows || [])
          .map((row) => normalizeDbTradeInRecord(row))
          .filter((row): row is TradeInRecord => Boolean(row));

        setRecords(normalized);
      } catch {
        try {
          const raw = window.localStorage.getItem(STORAGE_KEY);
          if (raw) {
            const parsed = JSON.parse(raw) as TradeInRecord[];
            setRecords(Array.isArray(parsed) ? parsed : []);
          } else {
            setRecords([]);
          }
        } catch {
          setRecords([]);
        }
      } finally {
        setLoadingRecords(false);
      }
    };

    void loadTradeInRecords();
  }, [dealerId, profile?.location_id]);

  const updateField = (field: keyof TradeInFormState, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!formData.customerName.trim() || !formData.phone.trim() || !formData.currentVehicle.trim()) {
      toast.error('Please fill in customer name, phone, and current vehicle details.');
      return;
    }

    const nowIso = new Date().toISOString();
    const finalForm = {
      ...formData,
      customerName: formData.customerName.trim(),
      phone: formData.phone.trim(),
      email: formData.email.trim(),
      preferredBrand: formData.preferredBrand.trim() || 'BMW',
      preferredModel: formData.preferredModel.trim(),
      currentVehicle: formData.currentVehicle.trim(),
      currentYear: formData.currentYear.trim(),
      currentMileage: formData.currentMileage.trim(),
      condition: formData.condition || 'Good',
      expectedOffer: formData.expectedOffer.trim(),
      notes: formData.notes.trim(),
      status: formData.status || 'New enquiry',
    };

    const dbPayload = {
      id: crypto.randomUUID(),
      customer_name: finalForm.customerName,
      phone: finalForm.phone,
      email: finalForm.email,
      preferred_brand: finalForm.preferredBrand,
      preferred_model: finalForm.preferredModel,
      current_vehicle: finalForm.currentVehicle,
      current_year: finalForm.currentYear,
      current_mileage: finalForm.currentMileage,
      condition: finalForm.condition,
      expected_offer: finalForm.expectedOffer,
      notes: finalForm.notes,
      status: finalForm.status,
      dealer_id: dealerId || null,
      location_id: profile?.location_id || null,
      created_at: nowIso,
      updated_at: nowIso,
    };

    try {
      const inserted = await saveTradeInRequest(dbPayload);

      const savedRecord = normalizeDbTradeInRecord(inserted || dbPayload);
      const nextRecord = savedRecord || {
        ...finalForm,
        id: dbPayload.id,
        createdAt: nowIso,
      };

      const updated = [nextRecord, ...records.filter((record) => record.id !== nextRecord.id)].slice(0, 8);
      setRecords(updated);
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch {
        // ignore local storage failures
      }
      setFormData(initialForm);
      toast.success('Trade-in request saved successfully.');
    } catch (error) {
      const fallbackRecord: TradeInRecord = {
        ...finalForm,
        id: dbPayload.id,
        createdAt: nowIso,
      };

      const updated = [fallbackRecord, ...records].slice(0, 8);
      setRecords(updated);
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch {
        // ignore local storage failures
      }
      setFormData(initialForm);
      toast.warning('Saved locally as backup. Please retry sync if the server is temporarily unavailable.');
      console.error('Trade-in save failed:', error);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
              <ArrowLeftRight className="h-3.5 w-3.5" />
              Trade-in desk
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Trade-in valuation requests</h1>
          </div>
          <Badge className="w-fit border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
            <ShieldCheck className="mr-1 h-3.5 w-3.5" />
            Leads ready for review
          </Badge>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.4fr_0.8fr]">
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-xl">
                <CarFront className="h-5 w-5 text-primary" />
                New trade-in enquiry
              </CardTitle>
              <CardDescription>
                Capture customer intent, current vehicle condition, and the desired replacement model.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="customerName">Customer name</Label>
                    <Input
                      id="customerName"
                      value={formData.customerName}
                      onChange={(e) => updateField('customerName', e.target.value)}
                      placeholder="John Smith"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone number</Label>
                    <Input
                      id="phone"
                      value={formData.phone}
                      onChange={(e) => updateField('phone', e.target.value)}
                      placeholder="+971 50 123 4567"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => updateField('email', e.target.value)}
                      placeholder="john@email.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="status">Lead status</Label>
                    <Select value={formData.status} onValueChange={(value) => updateField('status', value)}>
                      <SelectTrigger id="status"><SelectValue placeholder="Status" /></SelectTrigger>
                      <SelectContent>
                        {statusOptions.map((status) => (
                          <SelectItem key={status} value={status}>{status}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="preferredBrand">Preferred brand</Label>
                    <Select value={formData.preferredBrand} onValueChange={(value) => updateField('preferredBrand', value)}>
                      <SelectTrigger id="preferredBrand"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {['BMW', 'Mercedes', 'Audi', 'Porsche', 'Volkswagen', 'Toyota', 'Honda', 'Range Rover'].map((brand) => (
                          <SelectItem key={brand} value={brand}>{brand}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="preferredModel">Preferred model</Label>
                    <Input
                      id="preferredModel"
                      value={formData.preferredModel}
                      onChange={(e) => updateField('preferredModel', e.target.value)}
                      placeholder="BMW X5, Mercedes C-Class"
                    />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="currentVehicle">Current vehicle</Label>
                    <Input
                      id="currentVehicle"
                      value={formData.currentVehicle}
                      onChange={(e) => updateField('currentVehicle', e.target.value)}
                      placeholder="2019 Toyota Camry"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="currentYear">Year</Label>
                    <Input
                      id="currentYear"
                      value={formData.currentYear}
                      onChange={(e) => updateField('currentYear', e.target.value)}
                      placeholder="2020"
                    />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="currentMileage">Mileage</Label>
                    <Input
                      id="currentMileage"
                      value={formData.currentMileage}
                      onChange={(e) => updateField('currentMileage', e.target.value)}
                      placeholder="42,000 km"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="condition">Vehicle condition</Label>
                    <Select value={formData.condition} onValueChange={(value) => updateField('condition', value)}>
                      <SelectTrigger id="condition"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {conditionOptions.map((value) => (
                          <SelectItem key={value} value={value}>{value}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="expectedOffer">Expected trade-in value</Label>
                  <Input
                    id="expectedOffer"
                    value={formData.expectedOffer}
                    onChange={(e) => updateField('expectedOffer', e.target.value)}
                    placeholder="AED 75,000"
                  />
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3 dark:border-emerald-900/60 dark:bg-emerald-950/20">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-300">Market estimate</p>
                        <p className="mt-1 text-xl font-semibold text-emerald-800 dark:text-emerald-200">
                          {Number(formData.currentYear) && Number(formData.currentMileage.replace(/[^\d.]/g, '')) > 0
                            ? formatCurrency(estimatedValue)
                            : 'Enter year and mileage to estimate'}
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => updateField('expectedOffer', formatCurrency(estimatedValue))}
                        disabled={!formData.currentYear || !formData.currentMileage}
                      >
                        Use estimate
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    id="notes"
                    value={formData.notes}
                    onChange={(e) => updateField('notes', e.target.value)}
                    placeholder="Customer looking for a clean exchange with minimal downtime and finance support."
                    rows={5}
                  />
                </div>

                <div className="flex flex-wrap items-center gap-3 pt-2">
                  <Button type="submit" className="gap-2">
                    <Save className="h-4 w-4" />
                    Save valuation request
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setFormData(initialForm)}>
                    Reset form
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-xl">
                <Gauge className="h-5 w-5 text-primary" />
                Recent entries
              </CardTitle>
              <CardDescription>Latest trade-in requests captured in this dashboard.</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingRecords ? (
                <div className="rounded-xl border border-dashed border-border bg-muted/40 p-6 text-sm text-muted-foreground">
                  Loading trade-in requests...
                </div>
              ) : records.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border bg-muted/40 p-6 text-sm text-muted-foreground">
                  No trade-in requests saved yet.
                </div>
              ) : (
                <div className="space-y-3">
                  {records.map((record) => (
                    <div key={record.id} className="rounded-xl border border-border bg-muted/20 p-4">
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <p className="font-semibold text-foreground">{record.customerName}</p>
                        <Badge className={getTradeInStatusClasses(record.status)}>{record.status}</Badge>
                      </div>
                      <div className="space-y-1 text-sm text-muted-foreground">
                        <p>{record.currentVehicle} · {record.currentYear}</p>
                        <p>{record.phone}</p>
                        <p>{record.preferredBrand} {record.preferredModel}</p>
                      </div>
                      <div className="mt-3 text-xs text-muted-foreground">Saved {formatDate(record.createdAt)}</div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default TradeInPage;
