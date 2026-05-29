import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { apiDbQuery } from '@/lib/apiClient';
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

const MAX_COMPARE = 4;

const specFields = [
  { key: 'engine_type', label: 'Engine Type', icon: Zap },
  { key: 'horsepower', label: 'Power', icon: Gauge, format: (value: any) => value ? `${value} HP` : '—' },
  { key: 'torque', label: 'Torque', icon: ArrowUpRight },
  { key: 'acceleration', label: '0-100 km/h', icon: Timer },
  { key: 'top_speed', label: 'Top Speed', icon: Zap },
  { key: 'transmission', label: 'Transmission', icon: Car },
  { key: 'drive_type', label: 'Drive Type', icon: Car },
  { key: 'fuel_type', label: 'Fuel Type', icon: Fuel },
  { key: 'mileage', label: 'Mileage', icon: Fuel },
  { key: 'range_km', label: 'Range', icon: Battery, format: (value: any) => value ? `${value} km` : '—' },
  { key: 'battery_capacity', label: 'Battery', icon: Battery },
  { key: 'seating_capacity', label: 'Seats', icon: Users, format: (value: any) => value ? `${value} Seater` : '—' },
  { key: 'total_units', label: 'Total Units', icon: Car },
  { key: 'available_units', label: 'Available Units', icon: Car },
] as const;

const ComparePage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [allVehicles, setAllVehicles] = useState<any[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [compareSheetOpen, setCompareSheetOpen] = useState(false);
  const [openEnquiryVehicleId, setOpenEnquiryVehicleId] = useState<string | null>(null);
  const [availabilityEnquiry, setAvailabilityEnquiry] = useState<Record<string, { name: string; phone: string; message: string }>>({});
  const [sendingAvailabilityEnquiry, setSendingAvailabilityEnquiry] = useState<Record<string, boolean>>({});
  const [sentAvailabilityEnquiry, setSentAvailabilityEnquiry] = useState<Record<string, boolean>>({});

  useEffect(() => {
    (async () => {
      const vehicles = await apiDbQuery<any[]>({
        table: 'vehicles',
        action: 'select',
        select: '*',
        filters: [{ field: 'is_active', op: 'eq', value: true }],
        order: [
          { field: 'brand', ascending: true },
          { field: 'model', ascending: true },
        ],
      });

      const locationIds = Array.from(new Set((vehicles || []).map((vehicle: any) => vehicle.location_id).filter(Boolean)));
      const locations = locationIds.length
        ? await apiDbQuery<any[]>({
            table: 'locations',
            action: 'select',
            select: 'id, name',
            filters: [{ field: 'id', op: 'in', value: locationIds }],
          })
        : [];

      const locationMap = new Map((locations || []).map((loc: any) => [loc.id, loc]));
      setAllVehicles((vehicles || []).map((vehicle: any) => ({
        ...vehicle,
        locations: locationMap.get(vehicle.location_id) || null,
      })));
    })();
  }, []);

  useEffect(() => {
    const ids = searchParams.get('ids');
    if (ids) {
      setSelectedIds(ids.split(',').slice(0, MAX_COMPARE));
      setCompareSheetOpen(true);
    }
  }, [searchParams]);

  useEffect(() => {
    const nextParams = new URLSearchParams(searchParams);

    if (selectedIds.length > 0) {
      nextParams.set('ids', selectedIds.join(','));
    } else {
      nextParams.delete('ids');
    }

    if (nextParams.toString() !== searchParams.toString()) {
      setSearchParams(nextParams, { replace: true });
    }
  }, [selectedIds, searchParams, setSearchParams]);

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
    () => specFields.filter((spec) => selectedVehicles.some((vehicle: any) => vehicle?.[spec.key] != null && vehicle[spec.key] !== '')),
    [selectedVehicles]
  );

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

  const submitAvailabilityEnquiry = async (vehicle: any) => {
    if (sendingAvailabilityEnquiry[vehicle.id]) return;

    const payload = availabilityEnquiry[vehicle.id] || { name: '', phone: '', message: '' };
    if (!payload.name.trim() || !payload.phone.trim() || !payload.message.trim()) {
      toast.error('Please fill name, phone and message.');
      return;
    }

    setSendingAvailabilityEnquiry((prev) => ({ ...prev, [vehicle.id]: true }));

    try {
      const customerRows = await apiDbQuery<any[]>({
        table: 'customers',
        action: 'select',
        select: 'id',
        filters: [{ field: 'phone', op: 'eq', value: payload.phone.trim() }],
        limit: 1,
      });
      let customer = customerRows?.[0] || null;

      if (!customer) {
        const createdCustomer = await apiDbQuery<any>({
          table: 'customers',
          action: 'insert',
          select: 'id',
          payload: {
            full_name: payload.name.trim(),
            phone: payload.phone.trim(),
          },
        });

        const customerRow = Array.isArray(createdCustomer) ? createdCustomer[0] : createdCustomer;
        if (!customerRow?.id) throw new Error('Unable to create customer');
        customer = customerRow;
      }

      await apiDbQuery({
        table: 'communications',
        action: 'insert',
        payload: {
          customer_id: customer.id,
          type: 'sms',
          purpose: 'custom',
          sent_to: payload.phone.trim(),
          subject: `Availability Enquiry - ${vehicle.brand} ${vehicle.model}`,
          body: payload.message.trim(),
          status: 'pending',
        },
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
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_hsl(var(--primary)/0.12),_transparent_34%),linear-gradient(180deg,hsl(var(--background)),hsl(var(--muted)/0.35))]">
      <div className="sticky top-0 z-40 gradient-dark px-4 py-6 shadow-sm backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <Link to="/book" className="flex items-center gap-2 text-primary-foreground/70 transition-colors hover:text-primary-foreground">
            <ArrowLeft className="h-4 w-4" />
            <span className="text-sm font-medium">Back To Booking</span>
          </Link>

          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/15 ring-1 ring-white/10">
              <GitCompareArrows className="h-4 w-4 text-primary-foreground" />
            </div>
            <div className="text-center sm:text-left">
              <p className="text-[11px] uppercase tracking-[0.24em] text-primary-foreground/55">Vehicle Studio</p>
              <h1 className="text-lg font-heading font-bold text-primary-foreground sm:text-xl">Compare Vehicles</h1>
            </div>
          </div>

          <Link to="/" className="text-sm text-primary-foreground/70 transition-colors hover:text-primary-foreground">Home</Link>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:py-10">
        <div className="mb-8 rounded-3xl border border-border/60 bg-card/85 p-5 shadow-card backdrop-blur sm:p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary">Compare With Confidence</p>
              <h2 className="mt-2 text-2xl font-heading font-bold text-foreground sm:text-3xl">Browse every active vehicle as a card, then open a focused compare.</h2>
              <p className="mt-3 text-sm text-muted-foreground sm:text-base">Select up to four vehicles, review specs inside the side panel, and submit availability enquiries without leaving the page.</p>
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
             
            </div>
          </div>
        </div>

        {visibleVehicles.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-border bg-card/60 px-6 py-14 text-center shadow-card">
            <Car className="mx-auto h-14 w-14 text-muted-foreground/35" />
            <h2 className="mt-4 text-xl font-heading font-bold text-foreground">No Vehicles Available</h2>
            <p className="mt-2 text-sm text-muted-foreground">Active vehicles will appear here once inventory is published.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
            {visibleVehicles.map((vehicle: any) => {
              const isSelected = selectedIds.includes(vehicle.id);
              const isAvailable = vehicle.available_units > 0;

              return (
                <Card
                  key={vehicle.id}
                  className={`overflow-hidden rounded-3xl border transition-all duration-300 ${
                    isSelected
                      ? 'border-primary/50 shadow-[0_20px_70px_-32px_hsl(var(--primary)/0.7)]'
                      : 'border-border/60 shadow-card hover:-translate-y-1 hover:shadow-elevated'
                  }`}
                >
                  <CardContent className="flex h-full flex-col p-0">
                    <div className="relative h-52 overflow-hidden bg-muted/30">
                      {vehicle.image_url ? (
                        <img src={vehicle.image_url} alt={`${vehicle.brand} ${vehicle.model}`} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full items-center justify-center bg-gradient-to-br from-muted to-background">
                          <Car className="h-12 w-12 text-muted-foreground/35" />
                        </div>
                      )}

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
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="secondary" className={vehicle.engine_type === 'electric' ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'}>
                          {vehicle.engine_type === 'electric' ? 'EV' : vehicle.engine_type || 'Petrol'}
                        </Badge>
                        <Badge variant="secondary" className={isAvailable ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'}>
                          {isAvailable ? `${vehicle.available_units} Available` : 'Availability On Request'}
                        </Badge>
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
                              <Link to={`/book?vehicleId=${vehicle.id}`}>
                                <Button className="w-full rounded-xl gradient-primary border-0 text-primary-foreground gap-2">
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

      {selectedVehicles.length > 0 && (
        <div className="sticky bottom-0 z-30 border-t border-border/70 bg-background/90 backdrop-blur">
          <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Compare Queue</p>
              <p className="text-sm text-foreground">{selectedVehicles.length} vehicle{selectedVehicles.length > 1 ? 's' : ''} ready for comparison.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {selectedVehicles.map((vehicle: any) => (
                <Badge key={vehicle.id} variant="secondary" className="gap-1 rounded-full px-3 py-1">
                  {vehicle.brand} {vehicle.model}
                  <button type="button" onClick={() => removeVehicle(vehicle.id)}>
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setSelectedIds([])}>Clear</Button>
              <Button className="gap-2" onClick={() => setCompareSheetOpen(true)}>
                <GitCompareArrows className="h-4 w-4" />
                Open Compare
              </Button>
            </div>
          </div>
        </div>
      )}

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
                    {selectedVehicles.map((vehicle: any) => (
                      <div key={`selected-${vehicle.id}`} className="w-[180px] shrink-0 rounded-2xl border border-primary/30 bg-primary/5 p-3">
                        <div className="relative mb-3 overflow-hidden rounded-xl bg-muted/25">
                          {vehicle.image_url ? (
                            <img src={vehicle.image_url} alt={`${vehicle.brand} ${vehicle.model}`} className="h-24 w-full object-cover" />
                          ) : (
                            <div className="flex h-24 items-center justify-center">
                              <Car className="h-7 w-7 text-muted-foreground/35" />
                            </div>
                          )}
                        </div>
                        <p className="truncate text-sm font-semibold text-foreground">{vehicle.brand} {vehicle.model}</p>
                        <p className="truncate text-xs text-muted-foreground">{vehicle.variant || 'Signature Variant'}</p>
                        <Button variant="outline" size="sm" className="mt-3 w-full rounded-xl" onClick={() => removeVehicle(vehicle.id)}>
                          Remove
                        </Button>
                      </div>
                    ))}

                    {canvasVehicleOptions.map((vehicle: any) => (
                      <div key={`option-${vehicle.id}`} className="w-[180px] shrink-0 rounded-2xl border border-border/70 bg-background p-3">
                        <div className="relative mb-3 overflow-hidden rounded-xl bg-muted/25">
                          {vehicle.image_url ? (
                            <img src={vehicle.image_url} alt={`${vehicle.brand} ${vehicle.model}`} className="h-24 w-full object-cover" />
                          ) : (
                            <div className="flex h-24 items-center justify-center">
                              <Car className="h-7 w-7 text-muted-foreground/35" />
                            </div>
                          )}
                        </div>
                        <p className="truncate text-sm font-semibold text-foreground">{vehicle.brand} {vehicle.model}</p>
                        <p className="truncate text-xs text-muted-foreground">{vehicle.variant || 'Signature Variant'}</p>
                        <p className="mt-1 text-[11px] text-muted-foreground">{vehicle.available_units > 0 ? `${vehicle.available_units} Available` : 'Availability On Request'}</p>
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
                {selectedVehicles.map((vehicle: any) => (
                  <div key={vehicle.id} className="rounded-2xl border border-border/70 bg-card p-3 shadow-card">
                    <div className="relative overflow-hidden rounded-xl bg-muted/25">
                      {vehicle.image_url ? (
                        <img src={vehicle.image_url} alt={`${vehicle.brand} ${vehicle.model}`} className="h-36 w-full object-cover" />
                      ) : (
                        <div className="flex h-36 items-center justify-center">
                          <Car className="h-10 w-10 text-muted-foreground/35" />
                        </div>
                      )}
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
                        <Badge variant="secondary" className={vehicle.available_units > 0 ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'}>
                          {vehicle.available_units > 0 ? `${vehicle.available_units} Available` : 'Availability On Request'}
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
                        {vehicle.available_units > 0 ? (
                          <Link to={`/book?vehicleId=${vehicle.id}`}>
                            <Button className="w-full rounded-xl primary border-0 text-primary-foreground">Book Test Drive</Button>
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
                        {selectedVehicles.map((vehicle: any) => (
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
                        const values = selectedVehicles.map((vehicle: any) => Number(vehicle?.[spec.key]) || 0);
                        const maxValue = Math.max(...values);

                        return (
                          <tr key={spec.key} className="border-b border-border/50 last:border-b-0">
                            <td className="p-3 align-top">
                              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                                <Icon className="h-4 w-4 text-primary" />
                                {spec.label}
                              </div>
                            </td>
                            {selectedVehicles.map((vehicle: any) => {
                              const rawValue = vehicle?.[spec.key];
                              const displayValue = (spec as any).format ? (spec as any).format(rawValue) : (rawValue || '—');
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
  );
};

export default ComparePage;
