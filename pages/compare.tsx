import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { apiDbQuery, apiPost } from '@/lib/apiClient';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { toast } from 'sonner';
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Battery,
  Car,
  Check,
  Fuel,
  Gauge,
  GitCompareArrows,
  MapPin,
  Send,
  Timer,
  Users,
  X,
  Zap,
} from 'lucide-react';
import VehicleImage from '@/components/common/VehicleImage';
import MarketingPageShell from '../src/components/public/MarketingPageShell';
import { ROUTE_ALLOWED_ROLES } from '@/constants/roles';
import ProtectedRoute from '@/components/ProtectedRoute';

const MAX_COMPARE = 4;

type CompareVehicleLocation = {
  id: string;
  name: string;
};

type CompareVehicle = {
  id: string;
  brand: string;
  model: string;
  variant?: string | null;
  year?: string | number | null;
  image_url?: string | null;
  engine_type?: string | null;
  horsepower?: number | string | null;
  torque?: number | string | null;
  acceleration?: number | string | null;
  top_speed?: number | string | null;
  transmission?: string | null;
  drive_type?: string | null;
  fuel_type?: string | null;
  mileage?: string | null;
  range_km?: number | string | null;
  battery_capacity?: number | string | null;
  seating_capacity?: number | string | null;
  total_units?: number | string | null;
  available_units?: number | string | null;
  location_id?: string | null;
  is_active?: boolean;
  locations?: CompareVehicleLocation | null;
};

type CompareSpecField = {
  key: Exclude<keyof CompareVehicle, 'id' | 'location_id' | 'is_active' | 'locations'>;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  format?: (value: CompareVehicle[Exclude<keyof CompareVehicle, 'id' | 'location_id' | 'is_active' | 'locations'>]) => string;
};

const hasCompareVehicleValue = (vehicle: CompareVehicle, key: CompareSpecField['key']) => {
  const value = vehicle[key];
  return value != null && value !== '';
};

const formatCompareValue = (value: CompareSpecField['format'] extends ((value: infer T) => string) ? T : never, suffix = '') => (value ? `${value}${suffix}` : '—');

const specFields: CompareSpecField[] = [
  { key: 'engine_type', label: 'Engine Type', icon: Zap },
  { key: 'horsepower', label: 'Power', icon: Gauge, format: (value) => formatCompareValue(value, ' HP') },
  { key: 'torque', label: 'Torque', icon: ArrowUpRight },
  { key: 'acceleration', label: '0-100 km/h', icon: Timer },
  { key: 'top_speed', label: 'Top Speed', icon: Zap },
  { key: 'transmission', label: 'Transmission', icon: Car },
  { key: 'drive_type', label: 'Drive Type', icon: Car },
  { key: 'fuel_type', label: 'Fuel Type', icon: Fuel },
  { key: 'mileage', label: 'Mileage', icon: Fuel },
  { key: 'range_km', label: 'Range', icon: Battery, format: (value) => formatCompareValue(value, ' km') },
  { key: 'battery_capacity', label: 'Battery', icon: Battery },
  { key: 'seating_capacity', label: 'Seats', icon: Users, format: (value) => formatCompareValue(value, ' Seater') },
  { key: 'total_units', label: 'Total Units', icon: Car },
  { key: 'available_units', label: 'Available Units', icon: Car },
];

const ComparePage = () => {
  const router = useRouter();
  const [allVehicles, setAllVehicles] = useState<CompareVehicle[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [compareSheetOpen, setCompareSheetOpen] = useState(false);
  const [openEnquiryVehicleId, setOpenEnquiryVehicleId] = useState<string | null>(null);
  const [availabilityEnquiry, setAvailabilityEnquiry] = useState<Record<string, { name: string; phone: string; message: string }>>({});
  const [sendingAvailabilityEnquiry, setSendingAvailabilityEnquiry] = useState<Record<string, boolean>>({});
  const [sentAvailabilityEnquiry, setSentAvailabilityEnquiry] = useState<Record<string, boolean>>({});

  useEffect(() => {
    (async () => {
      const vehicles = await apiDbQuery<CompareVehicle[]>({
        table: 'vehicles',
        action: 'select',
        select: '*',
        filters: [{ field: 'is_active', op: 'eq', value: true }],
        order: [
          { field: 'brand', ascending: true },
          { field: 'model', ascending: true },
        ],
      });

      const locationIds = Array.from(new Set((vehicles || []).map((vehicle) => vehicle.location_id).filter(Boolean)));
      const locations = locationIds.length
        ? await apiDbQuery<CompareVehicleLocation[]>({
            table: 'locations',
            action: 'select',
            select: 'id, name',
            filters: [{ field: 'id', op: 'in', value: locationIds }],
          })
        : [];

      const locationMap = new Map((locations || []).map((loc) => [loc.id, loc]));
      setAllVehicles((vehicles || []).map((vehicle) => ({
        ...vehicle,
        locations: vehicle.location_id ? locationMap.get(vehicle.location_id) || null : null,
      })));
    })();
  }, []);

  useEffect(() => {
    if (!router.isReady) return;
    const ids = typeof router.query.ids === 'string' ? router.query.ids : Array.isArray(router.query.ids) ? router.query.ids[0] : '';
    if (ids) {
      setSelectedIds(ids.split(',').slice(0, MAX_COMPARE));
      setCompareSheetOpen(true);
    }
  }, [router.isReady, router.query.ids]);

  useEffect(() => {
    if (!router.isReady) return;
    const nextQuery: Record<string, string> = { ...router.query } as Record<string, string>;

    if (selectedIds.length > 0) {
      nextQuery.ids = selectedIds.join(',');
    } else {
      delete nextQuery.ids;
    }

    const currentIds = typeof router.query.ids === 'string' ? router.query.ids : '';
    if (nextQuery.ids !== currentIds) {
      router.replace({ pathname: router.pathname, query: nextQuery }, undefined, { shallow: true });
    }
  }, [selectedIds, router]);

  const selectedVehicles = useMemo(
    () => selectedIds.map((id) => allVehicles.find((vehicle) => vehicle.id === id)).filter(Boolean),
    [selectedIds, allVehicles]
  );

  const visibleVehicles = useMemo(
    () =>
      openEnquiryVehicleId
        ? allVehicles.filter((vehicle) => vehicle.id === openEnquiryVehicleId)
        : allVehicles,
    [allVehicles, openEnquiryVehicleId]
  );

  const compareSpecRows = useMemo(
    () => specFields.filter((spec) => selectedVehicles.some((vehicle) => vehicle ? hasCompareVehicleValue(vehicle, spec.key) : false)),
    [selectedVehicles]
  );

  const getAvailableUnits = (vehicle: CompareVehicle) => Number(vehicle.available_units ?? 0);

  const canvasVehicleOptions = useMemo(
    () => allVehicles.filter((vehicle) => !selectedIds.includes(vehicle.id)).slice(0, 12),
    [allVehicles, selectedIds]
  );

  const toggleCompareVehicle = (vehicleId: string) => {
    setSelectedIds((prev) => {
      if (prev.includes(vehicleId)) {
        return prev.filter((id) => id !== vehicleId);
      }

      if (prev.length >= MAX_COMPARE) {
        toast.error('You can compare up to 4 vehicles.');
        return prev;
      }

      return [...prev, vehicleId];
    });
  };

  const removeVehicle = (vehicleId: string) => {
    setSelectedIds((prev) => prev.filter((id) => id !== vehicleId));
  };

  const updateAvailabilityEnquiry = (vehicleId: string, field: 'name' | 'phone' | 'message', value: string) => {
    setAvailabilityEnquiry((prev) => ({
      ...prev,
      [vehicleId]: {
        name: prev[vehicleId]?.name || '',
        phone: prev[vehicleId]?.phone || '',
        message: prev[vehicleId]?.message || '',
        [field]: value,
      },
    }));
  };

  const submitAvailabilityEnquiry = async (vehicle: CompareVehicle) => {
    if (sendingAvailabilityEnquiry[vehicle.id]) return;

    const payload = availabilityEnquiry[vehicle.id] || { name: '', phone: '', message: '' };
    if (!payload.name.trim() || !payload.phone.trim() || !payload.message.trim()) {
      toast.error('Please fill name, phone and message.');
      return;
    }

    setSendingAvailabilityEnquiry((prev) => ({ ...prev, [vehicle.id]: true }));

    try {
      const customerRows = await apiDbQuery<Array<{ id: string }>>({
        table: 'customers',
        action: 'select',
        select: 'id',
        filters: [{ field: 'phone', op: 'eq', value: payload.phone.trim() }],
        limit: 1,
      });
      let customer = customerRows?.[0] || null;

      if (!customer) {
        const createdCustomer = await apiDbQuery<{ id: string }>({
          table: 'customers',
          action: 'insert',
          select: 'id',
          values: {
            full_name: payload.name.trim(),
            phone: payload.phone.trim(),
          },
        });

        const customerRow = Array.isArray(createdCustomer) ? createdCustomer[0] : createdCustomer;
        if (!customerRow?.id) throw new Error('Unable to create customer');
        customer = customerRow;
      }

      await apiPost('/api/communications', {
          customer_id: customer.id,
          type: 'sms',
          purpose: 'custom',
          sent_to: payload.phone.trim(),
          subject: `Availability Enquiry - ${vehicle.brand} ${vehicle.model}`,
          body: payload.message.trim(),
          status: 'pending',
        });

      setSentAvailabilityEnquiry((prev) => ({ ...prev, [vehicle.id]: true }));
      setAvailabilityEnquiry((prev) => ({
        ...prev,
        [vehicle.id]: { name: '', phone: '', message: '' },
      }));
      toast.success('Enquiry submitted successfully.');
    } catch {
      toast.error('Unable to submit enquiry. Please try again.');
    } finally {
      setSendingAvailabilityEnquiry((prev) => ({ ...prev, [vehicle.id]: false }));
    }
  };

  return (
    
    <ProtectedRoute allowedRoles={[...ROUTE_ALLOWED_ROLES.BOOKINGS]}>
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_hsl(var(--primary)/0.12),_transparent_34%),linear-gradient(180deg,hsl(var(--background)),hsl(var(--muted)/0.35))]">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:py-10">
        <div className="mb-8 rounded-3xl border border-border/60 bg-card/85 p-5 shadow-card backdrop-blur sm:p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary">Compare With Confidence</p>
              <h2 className="mt-2 text-2xl font-heading font-bold text-foreground sm:text-3xl">Compare vehicles in one clean workspace.</h2>
              <p className="mt-3 text-sm text-muted-foreground sm:text-base">Pick up to four vehicles, scan the cards, and open a side-by-side compare panel without bouncing between screens.</p>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-border bg-muted/25 px-4 py-3">
                <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Active Vehicles</p>
                <p className="mt-1 text-2xl font-heading font-bold text-foreground">{allVehicles.length}</p>
              </div>
              <div className="rounded-2xl border border-border bg-muted/25 px-4 py-3">
                <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Selected</p>
                <p className="mt-1 text-2xl font-heading font-bold text-foreground">{selectedVehicles.length}/{MAX_COMPARE}</p>
              </div>
              <div className="rounded-2xl border border-border bg-muted/25 px-4 py-3">
                <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Ready</p>
                <p className="mt-1 text-2xl font-heading font-bold text-foreground">{selectedVehicles.length > 0 ? 'Yes' : 'No'}</p>
              </div>
            </div>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-3">
            {[
              {
                title: 'Select quickly',
                description: 'Tap compare on any vehicle card to add it to your shortlist.',
                icon: GitCompareArrows,
              },
              {
                title: 'Review the specs',
                description: 'Open the compare panel for a clear spec matrix and vehicle snapshots.',
                icon: Gauge,
              },
              {
                title: 'Book or enquire',
                description: 'Jump straight to booking or send an availability enquiry in context.',
                icon: Send,
              },
            ].map((step) => {
              const Icon = step.icon;
              return (
                <div key={step.title} className="rounded-2xl border border-border/70 bg-background/80 p-4 shadow-sm">
                  <div className="flex items-center gap-2">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <Icon className="h-4 w-4" />
                    </div>
                    <h3 className="font-semibold text-foreground">{step.title}</h3>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{step.description}</p>
                </div>
              );
            })}
          </div>
        </div>

        {selectedVehicles.length > 0 && (
          <div className="mb-6 rounded-3xl border border-primary/20 bg-primary/5 p-4 shadow-card backdrop-blur">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Compare Queue</p>
                <p className="text-sm text-foreground">{selectedVehicles.length} vehicle{selectedVehicles.length > 1 ? 's' : ''} selected and ready.</p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {selectedVehicles.map((vehicle) => (
                  <div key={vehicle.id} className="flex items-center gap-2 rounded-full border border-border/70 bg-background px-2 py-1.5">
                    <VehicleImage
                      imageUrl={vehicle.image_url}
                      brand={vehicle.brand}
                      model={vehicle.model}
                      className="h-7 w-7 rounded-full object-cover border border-border shrink-0"
                    />
                    <span className="max-w-[140px] truncate text-sm font-medium text-foreground">{vehicle.brand} {vehicle.model}</span>
                    <button type="button" onClick={() => removeVehicle(vehicle.id)} className="rounded-full p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => setSelectedIds([])}>Clear</Button>
                <Button className="gap-2" onClick={() => setCompareSheetOpen(true)}>
                  <GitCompareArrows className="h-4 w-4" />
                  Open Compare
                </Button>
              </div>
            </div>
          </div>
        )}

        {visibleVehicles.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-border bg-card/60 px-6 py-14 text-center shadow-card">
            <Car className="mx-auto h-14 w-14 text-muted-foreground/35" />
            <h2 className="mt-4 text-xl font-heading font-bold text-foreground">No Vehicles Available</h2>
            <p className="mt-2 text-sm text-muted-foreground">Active vehicles will appear here once inventory is published.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
            {visibleVehicles.map((vehicle) => {
              const isSelected = selectedIds.includes(vehicle.id);
              const isAvailable = getAvailableUnits(vehicle) > 0;

              return (
                <Card
                  key={vehicle.id}
                  className={`overflow-hidden rounded-3xl border transition-all duration-300 ${
                    isSelected
                      ? 'border-primary/50 bg-primary/5 shadow-[0_20px_70px_-32px_hsl(var(--primary)/0.7)]'
                      : 'border-border/60 shadow-card hover:-translate-y-1 hover:shadow-elevated'
                  }`}
                >
                  <CardContent className="flex h-full flex-col p-0">
                    <div className="relative h-52 overflow-hidden bg-muted/30">
                      <VehicleImage
                        imageUrl={vehicle.image_url}
                        brand={vehicle.brand}
                        model={vehicle.model}
                        className="h-full w-full object-cover"
                      />

                      <div className="absolute left-4 top-4 flex flex-wrap gap-2">
                        <Badge className="rounded-full bg-background/85 px-2.5 py-1 text-[11px] font-medium text-foreground shadow-sm backdrop-blur">
                          {vehicle.year || 'Latest'}
                        </Badge>
                        <Badge className="rounded-full bg-background/85 px-2.5 py-1 text-[11px] font-medium text-foreground shadow-sm backdrop-blur">
                          {vehicle.locations?.name || 'Location pending'}
                        </Badge>
                      </div>

                      <div className="absolute inset-x-0 bottom-0 flex items-end justify-between bg-gradient-to-t from-black/65 via-black/20 to-transparent p-4">
                        <div>
                          <p className="text-[11px] uppercase tracking-[0.18em] text-white/70">{vehicle.year || 'Latest'} Edition</p>
                          <h3 className="text-xl font-heading font-bold text-white">{vehicle.brand} {vehicle.model}</h3>
                          <p className="text-xs text-white/75">{vehicle.variant || 'Signature Variant'}</p>
                        </div>
                        {isSelected && (
                          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg">
                            <Check className="h-4 w-4" />
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-1 flex-col p-5">
                      <div className="rounded-2xl border border-border/70 bg-muted/15 p-3">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Quick summary</p>
                            <p className="mt-1 text-sm font-semibold text-foreground">{vehicle.brand} {vehicle.model}</p>
                          </div>
                          <p className="text-right text-xs text-muted-foreground">{vehicle.variant || 'Signature Variant'}</p>
                        </div>
                        <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                          <div className="rounded-xl bg-background px-2 py-2 text-center shadow-sm">
                            <p className="text-muted-foreground">Power</p>
                            <p className="mt-1 font-semibold text-foreground">{vehicle.horsepower ? `${vehicle.horsepower} HP` : '—'}</p>
                          </div>
                          <div className="rounded-xl bg-background px-2 py-2 text-center shadow-sm">
                            <p className="text-muted-foreground">Range</p>
                            <p className="mt-1 font-semibold text-foreground">{vehicle.range_km ? `${vehicle.range_km} km` : vehicle.mileage || '—'}</p>
                          </div>
                          <div className="rounded-xl bg-background px-2 py-2 text-center shadow-sm">
                            <p className="text-muted-foreground">Seats</p>
                            <p className="mt-1 font-semibold text-foreground">{vehicle.seating_capacity ? `${vehicle.seating_capacity}` : '—'}</p>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <Badge variant="secondary" className={vehicle.engine_type === 'electric' ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'}>
                          {vehicle.engine_type === 'electric' ? 'EV' : vehicle.engine_type || 'Petrol'}
                        </Badge>
                        <Badge variant="secondary" className={isAvailable ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'}>
                          {isAvailable ? `${vehicle.available_units} Available` : 'Availability On Request'}
                        </Badge>
                        {isSelected && (
                          <Badge variant="secondary" className="bg-primary/10 text-primary">
                            Selected
                          </Badge>
                        )}
                      </div>

                      <div className="mt-4 grid grid-cols-2 gap-3 rounded-2xl border border-border/70 bg-muted/15 p-3">
                        <div>
                          <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Power</p>
                          <p className="mt-1 text-sm font-semibold text-foreground">{vehicle.horsepower ? `${vehicle.horsepower} HP` : '—'}</p>
                        </div>
                        <div>
                          <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Range</p>
                          <p className="mt-1 text-sm font-semibold text-foreground">{vehicle.range_km ? `${vehicle.range_km} km` : vehicle.mileage || '—'}</p>
                        </div>
                        <div>
                          <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Seats</p>
                          <p className="mt-1 text-sm font-semibold text-foreground">{vehicle.seating_capacity ? `${vehicle.seating_capacity} Seater` : '—'}</p>
                        </div>
                        <div>
                          <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Location</p>
                          <p className="mt-1 inline-flex items-center gap-1 text-sm font-semibold text-foreground">
                            <MapPin className="h-3.5 w-3.5 text-primary" />
                            {vehicle.locations?.name || 'Location Pending'}
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 flex flex-1 flex-col justify-end">
                        {isAvailable ? (
                          <div className="space-y-2">
                            <div className="grid grid-cols-2 gap-2">
                              <Button
                                variant={isSelected ? 'outline' : 'default'}
                                className="rounded-xl gap-2"
                                onClick={() => toggleCompareVehicle(vehicle.id)}
                              >
                                <GitCompareArrows className="h-4 w-4" />
                                {isSelected ? 'Remove' : 'Add To Compare'}
                              </Button>
                              <Link href={`/book?vehicleId=${vehicle.id}`}>
                                <Button className="w-full rounded-xl gap-2">
                                  Book Now
                                  <ArrowRight className="h-4 w-4" />
                                </Button>
                              </Link>
                            </div>
                            <Button
                              variant="ghost"
                              className="w-full justify-between rounded-xl border border-border/70 bg-background/50"
                              onClick={() => {
                                if (!isSelected) {
                                  toggleCompareVehicle(vehicle.id);
                                }
                                setCompareSheetOpen(true);
                              }}
                            >
                              Quick Compare Preview
                              <ArrowRight className="h-4 w-4" />
                            </Button>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <Button
                              className="w-full rounded-xl border border-border bg-muted text-muted-foreground hover:bg-muted/80"
                              onClick={() => setOpenEnquiryVehicleId((prev) => (prev === vehicle.id ? null : vehicle.id))}
                            >
                              {openEnquiryVehicleId === vehicle.id ? 'Close Enquiry' : 'Enquiry For Availability'}
                            </Button>

                            {openEnquiryVehicleId === vehicle.id && (
                              <div className="space-y-2 rounded-2xl border border-border bg-muted/20 p-3">
                                {sentAvailabilityEnquiry[vehicle.id] ? (
                                  <p className="text-sm font-medium text-success">Thanks. Your enquiry has been submitted.</p>
                                ) : (
                                  <>
                                    <Input
                                      value={availabilityEnquiry[vehicle.id]?.name || ''}
                                      onChange={(event) => updateAvailabilityEnquiry(vehicle.id, 'name', event.target.value)}
                                      placeholder="Your Name"
                                      className="h-9"
                                    />
                                    <Input
                                      value={availabilityEnquiry[vehicle.id]?.phone || ''}
                                      onChange={(event) => updateAvailabilityEnquiry(vehicle.id, 'phone', event.target.value)}
                                      placeholder="Phone Number"
                                      className="h-9"
                                    />
                                    <Textarea
                                      value={availabilityEnquiry[vehicle.id]?.message || ''}
                                      onChange={(event) => updateAvailabilityEnquiry(vehicle.id, 'message', event.target.value)}
                                      placeholder={`I want availability update for ${vehicle.brand} ${vehicle.model}.`}
                                      className="min-h-[78px]"
                                    />
                                    <Button
                                      className="w-full rounded-xl gap-2"
                                      onClick={() => void submitAvailabilityEnquiry(vehicle)}
                                      disabled={Boolean(sendingAvailabilityEnquiry[vehicle.id])}
                                    >
                                      <Send className="h-4 w-4" />
                                      {sendingAvailabilityEnquiry[vehicle.id] ? 'Submitting Enquiry...' : 'Send Enquiry'}
                                    </Button>
                                  </>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <Sheet open={compareSheetOpen} onOpenChange={setCompareSheetOpen}>
        <SheetContent side="right" className="w-full overflow-y-auto border-l border-border/70 sm:max-w-4xl">
          <SheetHeader className="pr-8">
            <SheetTitle className="font-heading text-2xl">Compare Your Drive</SheetTitle>
            <SheetDescription>
              Review selected vehicles side by side, remove any option instantly, and jump into booking when ready.
            </SheetDescription>
          </SheetHeader>

          {selectedVehicles.length === 0 ? (
            <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
              <Car className="h-14 w-14 text-muted-foreground/35" />
              <h3 className="mt-4 text-xl font-heading font-bold text-foreground">No Vehicles Selected</h3>
              <p className="mt-2 max-w-sm text-sm text-muted-foreground">Add vehicles from the card grid to open a meaningful comparison.</p>
            </div>
          ) : (
            <div className="mt-6 space-y-6">
              <div className="rounded-2xl border border-border/70 bg-card shadow-card">
                <div className="border-b border-border/70 px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="font-heading text-lg font-bold text-foreground">Add More Vehicles</h3>
                      <p className="text-sm text-muted-foreground">Pick more vehicles directly from this canvas. Maximum {MAX_COMPARE} vehicles can be compared.</p>
                    </div>
                    <Badge variant="secondary" className="rounded-full px-3 py-1">
                      {selectedVehicles.length}/{MAX_COMPARE} Selected
                    </Badge>
                  </div>
                </div>

                <div className="overflow-x-auto px-4 py-4">
                  <div className="flex gap-3 pb-1">
                    {selectedVehicles.map((vehicle) => (
                      <div key={`selected-${vehicle.id}`} className="w-[200px] shrink-0 rounded-2xl border border-primary/30 bg-primary/5 p-3 shadow-sm">
                        <div className="relative mb-3 overflow-hidden rounded-xl bg-muted/25">
                          <VehicleImage
                            imageUrl={vehicle.image_url}
                            brand={vehicle.brand}
                            model={vehicle.model}
                            className="h-28 w-full object-cover"
                          />
                          <div className="absolute left-2 top-2 rounded-full bg-background/85 px-2 py-0.5 text-[10px] font-medium text-foreground shadow-sm backdrop-blur">
                            Selected
                          </div>
                          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-2">
                            <p className="truncate text-xs font-semibold text-white">{vehicle.year || 'Latest'} • {vehicle.location_id ? 'Preferred location' : 'No location set'}</p>
                          </div>
                        </div>
                        <p className="truncate text-sm font-semibold text-foreground">{vehicle.brand} {vehicle.model}</p>
                        <p className="truncate text-xs text-muted-foreground">{vehicle.variant || 'Signature Variant'}</p>
                        <div className="mt-2 flex flex-wrap gap-1.5 text-[10px]">
                          <Badge variant="secondary" className="rounded-full px-2 py-0.5">{vehicle.engine_type || 'Petrol'}</Badge>
                          <Badge variant="secondary" className="rounded-full px-2 py-0.5">{getAvailableUnits(vehicle) > 0 ? `${getAvailableUnits(vehicle)} Available` : 'On Request'}</Badge>
                        </div>
                        <Button variant="outline" size="sm" className="mt-3 w-full rounded-xl" onClick={() => removeVehicle(vehicle.id)}>
                          Remove
                        </Button>
                      </div>
                    ))}

                    {canvasVehicleOptions.map((vehicle) => (
                      <div key={`option-${vehicle.id}`} className="w-[200px] shrink-0 rounded-2xl border border-border/70 bg-background p-3 shadow-sm">
                        <div className="relative mb-3 overflow-hidden rounded-xl bg-muted/25">
                          <VehicleImage
                            imageUrl={vehicle.image_url}
                            brand={vehicle.brand}
                            model={vehicle.model}
                            className="h-28 w-full object-cover"
                          />
                          <div className="absolute right-2 top-2 rounded-full bg-background/85 px-2 py-0.5 text-[10px] font-medium text-foreground shadow-sm backdrop-blur">
                            Add to compare
                          </div>
                          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-2">
                            <p className="truncate text-xs font-semibold text-white">{vehicle.year || 'Latest'} • {vehicle.locations?.name || 'Location pending'}</p>
                          </div>
                        </div>
                        <p className="truncate text-sm font-semibold text-foreground">{vehicle.brand} {vehicle.model}</p>
                        <p className="truncate text-xs text-muted-foreground">{vehicle.variant || 'Signature Variant'}</p>
                        <p className="mt-1 text-[11px] text-muted-foreground">{getAvailableUnits(vehicle) > 0 ? `${getAvailableUnits(vehicle)} Available` : 'Availability On Request'}</p>
                        <Button
                          size="sm"
                          className="mt-3 w-full rounded-xl"
                          variant="default"
                          onClick={() => toggleCompareVehicle(vehicle.id)}
                          disabled={selectedVehicles.length >= MAX_COMPARE}
                        >
                          Add To Compare
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {selectedVehicles.map((vehicle) => (
                  <div key={vehicle.id} className="rounded-2xl border border-border/70 bg-card p-3 shadow-card">
                    <div className="relative overflow-hidden rounded-xl bg-muted/25">
                      <VehicleImage
                        imageUrl={vehicle.image_url}
                        brand={vehicle.brand}
                        model={vehicle.model}
                        className="h-40 w-full object-cover"
                      />
                      <div className="absolute left-3 top-3 rounded-full bg-background/85 px-2.5 py-1 text-[11px] font-medium text-foreground shadow-sm backdrop-blur">
                        {vehicle.year || 'Latest'}
                      </div>
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/65 via-black/20 to-transparent p-3">
                        <p className="truncate text-xs font-semibold text-white">{vehicle.brand} {vehicle.model}</p>
                        <p className="truncate text-[11px] text-white/75">{vehicle.variant || 'Signature Variant'}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeVehicle(vehicle.id)}
                        className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-background/90 text-foreground shadow"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="mt-3">
                      <h3 className="font-heading text-lg font-bold text-foreground">{vehicle.brand} {vehicle.model}</h3>
                      <p className="text-sm text-muted-foreground">{vehicle.variant || 'Signature Variant'} · {vehicle.year || 'Latest'}</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Badge variant="secondary" className={getAvailableUnits(vehicle) > 0 ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'}>
                          {getAvailableUnits(vehicle) > 0 ? `${getAvailableUnits(vehicle)} Available` : 'Availability On Request'}
                        </Badge>
                        <Badge variant="secondary">{vehicle.engine_type || 'Petrol'}</Badge>
                      </div>
                      <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
                        <div className="rounded-xl border border-border/60 bg-muted/20 p-2">
                          <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Power</p>
                          <p className="mt-1 font-semibold text-foreground">{vehicle.horsepower ? `${vehicle.horsepower} HP` : '—'}</p>
                        </div>
                        <div className="rounded-xl border border-border/60 bg-muted/20 p-2">
                          <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Range</p>
                          <p className="mt-1 font-semibold text-foreground">{vehicle.range_km ? `${vehicle.range_km} km` : vehicle.mileage || '—'}</p>
                        </div>
                      </div>
                      <div className="mt-4 space-y-2">
                        {Number(vehicle.available_units || 0) > 0 ? (
                          <Link href={`/book?vehicleId=${vehicle.id}`}>
                            <Button className="w-full rounded-xl">Book Test Drive</Button>
                          </Link>
                        ) : (
                          <Button
                            variant="outline"
                            className="w-full rounded-xl"
                            onClick={() => {
                              setCompareSheetOpen(false);
                              setOpenEnquiryVehicleId(vehicle.id);
                              window.scrollTo({ top: 0, behavior: 'smooth' });
                            }}
                          >
                            Open Enquiry Form
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-card">
                <div className="border-b border-border/70 px-4 py-3">
                  <h3 className="font-heading text-lg font-bold text-foreground">Specification Matrix</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[720px] border-collapse">
                    <thead>
                      <tr className="border-b border-border/70 bg-muted/20">
                        <th className="p-3 text-left text-sm font-medium text-muted-foreground">Specification</th>
                        {selectedVehicles.map((vehicle) => (
                          <th key={vehicle.id} className="p-3 text-left text-sm font-medium text-foreground">
                            {vehicle.brand} {vehicle.model}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {compareSpecRows.map((spec) => {
                        const Icon = spec.icon;
                        const numericKeys = ['horsepower', 'range_km', 'seating_capacity', 'available_units'];
                        const values = selectedVehicles.map((vehicle) => Number(vehicle?.[spec.key] || 0));
                        const maxValue = Math.max(...values);

                        return (
                          <tr key={spec.key} className="border-b border-border/50 last:border-b-0">
                            <td className="p-3 align-top">
                              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                                <Icon className="h-4 w-4 text-primary" />
                                {spec.label}
                              </div>
                            </td>
                            {selectedVehicles.map((vehicle) => {
                              const rawValue = vehicle?.[spec.key];
                              const displayValue = spec.format ? spec.format(rawValue) : (rawValue || '—');
                              const isBest = numericKeys.includes(spec.key) && Number(rawValue) === maxValue && maxValue > 0;

                              return (
                                <td key={vehicle.id} className="p-3 align-top">
                                  <span className={`text-sm ${isBest ? 'font-bold text-success' : 'text-foreground'}`}>
                                    {displayValue}
                                  </span>
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
    </ProtectedRoute>
  );
};

export default ComparePage;
