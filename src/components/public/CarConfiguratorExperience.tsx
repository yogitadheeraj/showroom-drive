import { useEffect, useMemo, useState } from 'react';
import { apiDbQuery } from '@/lib/apiClient';
import { navigateTo } from '@/lib/browserNavigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import VehicleImage from '@/components/common/VehicleImage';
import {
  ArrowRight,
  BadgeIndianRupee,
  CarFront,
  CheckCircle2,
  CircleDot,
  Layers3,
  Palette,
  ShieldCheck,
  Sofa,
  Sparkles,
  Wrench,
} from 'lucide-react';

type ConfigVehicle = {
  id: string;
  brand: string;
  model: string;
  variant?: string | null;
  year?: string | number | null;
  image_url?: string | null;
  horsepower?: number | string | null;
  range_km?: number | string | null;
  seating_capacity?: number | string | null;
  set_price?: number | string | null;
  price?: number | string | null;
  location_id?: string | null;
  locations?: { id: string; name: string } | null;
};

type SingleOption = {
  id: string;
  name: string;
  detail: string;
  price: number;
  swatch?: string;
};

type ToggleOption = {
  id: string;
  name: string;
  detail: string;
  price: number;
};

const staticBrandImageCatalog = {
  toyota: [
    '/vehicles/toyota/1.png',
    '/vehicles/toyota/2.jpeg',
    '/vehicles/toyota/3.avif',
    '/vehicles/toyota/4.jpeg',
    '/vehicles/toyota/5.jpg',
  ],
  lexus: [
    '/vehicles/lexus/1.jpg',
    '/vehicles/lexus/2.jpg',
    '/vehicles/lexus/3.jpg',
    '/vehicles/lexus/4.png',
  ],
} as const;

const exteriorOptions: SingleOption[] = [
  { id: 'graphite', name: 'Graphite Metallic', detail: 'Deep metallic finish with satin clear coat', price: 0, swatch: 'linear-gradient(135deg,#5f6772,#c1c7d0)' },
  { id: 'arctic', name: 'Arctic Pearl', detail: 'Premium tri-coat white with crystal lift', price: 32000, swatch: 'linear-gradient(135deg,#f8fafc,#dbe5f0)' },
  { id: 'crimson', name: 'Crimson Velocity', detail: 'High-energy ruby tone for launch presence', price: 46000, swatch: 'linear-gradient(135deg,#7f1d1d,#ef4444)' },
  { id: 'midnight', name: 'Midnight Sapphire', detail: 'Ink blue finish with gloss flake depth', price: 38000, swatch: 'linear-gradient(135deg,#0f172a,#2563eb)' },
];

const wheelOptions: SingleOption[] = [
  { id: 'aero19', name: '19" Aero Flow', detail: 'Efficiency-tuned alloy set', price: 0 },
  { id: 'sport20', name: '20" Sport Turbine', detail: 'Diamond-cut dynamic spoke design', price: 58000 },
  { id: 'black21', name: '21" Black Edition', detail: 'Gloss black forged package', price: 92000 },
];

const interiorOptions: SingleOption[] = [
  { id: 'obsidian', name: 'Obsidian Black', detail: 'Monotone cabin with satin chrome accents', price: 0 },
  { id: 'sandstone', name: 'Sandstone Beige', detail: 'Open-pore wood and warm ambient palette', price: 36000 },
  { id: 'oxblood', name: 'Oxblood Atelier', detail: 'Performance quilt with contrast piping', price: 52000 },
];

const extrasOptions: ToggleOption[] = [
  { id: 'adas', name: 'Autonomy Suite', detail: 'Adaptive cruise, lane-centering, 360 safety sensors', price: 145000 },
  { id: 'panoramic', name: 'Panoramic Glass Roof', detail: 'Electrochromic glass roof with solar tint', price: 96000 },
  { id: 'audio', name: 'Immersive 18-Speaker Audio', detail: 'Premium surround audio with active noise shaping', price: 88000 },
  { id: 'performance', name: 'Performance Boost', detail: 'Enhanced drive mode and dynamic chassis tune', price: 110000 },
];

const accessoryOptions: ToggleOption[] = [
  { id: 'charger', name: 'Home Charger Kit', detail: 'Smart wall box with app scheduling', price: 74000 },
  { id: 'protection', name: 'Protection Pack', detail: 'All-weather mats, sill guards, cargo liner', price: 18000 },
  { id: 'carrier', name: 'Roof Carrier System', detail: 'Low-profile modular crossbar package', price: 26000 },
  { id: 'dashcam', name: 'Dual Dashcam', detail: 'Front and rear event recording setup', price: 22000 },
];

const financeTerms = [24, 36, 48, 60, 72];

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(Number.isFinite(value) ? value : 0);

const normalizeSearchVehicleId = () => {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  return params.get('vehicleId') || null;
};

const parseCurrencyNumber = (value: string) => Number(value.replace(/[^0-9.]/g, '')) || 0;

const buildStaticCatalogVehicles = (): ConfigVehicle[] => {
  const staticEntries = Object.entries(staticBrandImageCatalog).flatMap(([brand, imageUrls]) =>
    imageUrls.map((imageUrl, index) => ({
      id: `static-${brand}-${index + 1}`,
      brand: brand.charAt(0).toUpperCase() + brand.slice(1),
      model: `Showroom ${index + 1}`,
      variant: 'Configurator Edition',
      year: new Date().getFullYear(),
      image_url: imageUrl,
      horsepower: null,
      range_km: null,
      seating_capacity: null,
      set_price: null,
      price: null,
      location_id: null,
      locations: null,
    })),
  );

  return staticEntries;
};

export default function CarConfiguratorExperience() {
  const [vehicles, setVehicles] = useState<ConfigVehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const [selectedExteriorId, setSelectedExteriorId] = useState(exteriorOptions[0].id);
  const [selectedWheelId, setSelectedWheelId] = useState(wheelOptions[0].id);
  const [selectedInteriorId, setSelectedInteriorId] = useState(interiorOptions[0].id);
  const [selectedExtras, setSelectedExtras] = useState<string[]>(['adas']);
  const [selectedAccessories, setSelectedAccessories] = useState<string[]>(['protection']);
  const [downPayment, setDownPayment] = useState('250000');
  const [interestRate, setInterestRate] = useState('8.75');
  const [termMonths, setTermMonths] = useState('48');
  const staticCatalogVehicles = useMemo(() => buildStaticCatalogVehicles(), []);

  useEffect(() => {
    let cancelled = false;

    const loadVehicles = async () => {
      setLoading(true);
      try {
        const fetchedVehicles = await apiDbQuery<ConfigVehicle[]>({
          table: 'vehicles',
          action: 'select',
          select: '*',
          filters: [{ field: 'is_active', op: 'eq', value: true }],
          order: [
            { field: 'brand', ascending: true },
            { field: 'model', ascending: true },
          ],
          limit: 24,
        });

        const locationIds = Array.from(new Set((fetchedVehicles || []).map((vehicle) => vehicle.location_id).filter(Boolean)));
        const locations = locationIds.length
          ? await apiDbQuery<Array<{ id: string; name: string }>>({
              table: 'locations',
              action: 'select',
              select: 'id, name',
              filters: [{ field: 'id', op: 'in', value: locationIds }],
            })
          : [];

        if (cancelled) return;

        const locationMap = new Map((locations || []).map((location) => [location.id, location]));
        const enrichedVehicles = (fetchedVehicles || []).map((vehicle) => ({
          ...vehicle,
          locations: vehicle.location_id ? locationMap.get(vehicle.location_id) || null : null,
        }));

        const mergedVehicles: ConfigVehicle[] = [...enrichedVehicles];
        for (const staticVehicle of staticCatalogVehicles) {
          const hasSameImage = mergedVehicles.some((vehicle) => (vehicle.image_url || '').toLowerCase() === (staticVehicle.image_url || '').toLowerCase());
          if (!hasSameImage) mergedVehicles.push(staticVehicle);
        }

        setVehicles(mergedVehicles);
        const searchVehicleId = normalizeSearchVehicleId();
        const initialVehicle = mergedVehicles.find((vehicle) => vehicle.id === searchVehicleId) || mergedVehicles[0] || null;
        setSelectedVehicleId(initialVehicle?.id || null);
      } catch (error) {
        if (cancelled) return;
        console.error('Failed to load live inventory for configurator', error);
        setVehicles(staticCatalogVehicles);
        setSelectedVehicleId(staticCatalogVehicles[0]?.id || null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void loadVehicles();

    return () => {
      cancelled = true;
    };
  }, [staticCatalogVehicles]);

  const selectedVehicle = useMemo(
    () => vehicles.find((vehicle) => vehicle.id === selectedVehicleId) || vehicles[0] || null,
    [vehicles, selectedVehicleId],
  );

  const selectedExterior = exteriorOptions.find((option) => option.id === selectedExteriorId) || exteriorOptions[0];
  const selectedWheel = wheelOptions.find((option) => option.id === selectedWheelId) || wheelOptions[0];
  const selectedInterior = interiorOptions.find((option) => option.id === selectedInteriorId) || interiorOptions[0];
  const chosenExtras = extrasOptions.filter((option) => selectedExtras.includes(option.id));
  const chosenAccessories = accessoryOptions.filter((option) => selectedAccessories.includes(option.id));

  const basePrice = Number(selectedVehicle?.set_price || selectedVehicle?.price || 0);
  const optionsTotal = [selectedExterior.price, selectedWheel.price, selectedInterior.price]
    .concat(chosenExtras.map((option) => option.price))
    .concat(chosenAccessories.map((option) => option.price))
    .reduce((sum, amount) => sum + amount, 0);
  const subtotal = basePrice + optionsTotal;
  const parsedDownPayment = Math.max(0, parseCurrencyNumber(downPayment));
  const apr = Math.max(0, Number(interestRate) || 0);
  const months = Math.max(1, Number(termMonths) || 1);
  const financedAmount = Math.max(0, subtotal - parsedDownPayment);
  const monthlyRate = apr / 12 / 100;
  const estimatedMonthly = monthlyRate === 0
    ? financedAmount / months
    : (financedAmount * monthlyRate * Math.pow(1 + monthlyRate, months)) / (Math.pow(1 + monthlyRate, months) - 1);

  const toggleSelection = (
    id: string,
    selected: string[],
    setSelected: React.Dispatch<React.SetStateAction<string[]>>,
  ) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((entry) => entry !== id) : [...prev, id]));
  };

  const handleReserve = () => {
    if (!selectedVehicle) return;
    const modelName = encodeURIComponent(`${selectedVehicle.brand} ${selectedVehicle.model}`);
    navigateTo(`/book?vehicleId=${encodeURIComponent(selectedVehicle.id)}&modelName=${modelName}`);
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(15,118,110,0.16),_transparent_30%),radial-gradient(circle_at_top_right,_rgba(249,115,22,0.12),_transparent_24%),linear-gradient(180deg,hsl(var(--background)),hsl(var(--muted)/0.25))]">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
        <div className="mb-8 rounded-[2rem] border border-border/60 bg-card/85 p-6 shadow-card backdrop-blur sm:p-8">
          <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr] lg:items-end">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.24em] text-primary">
                <Sparkles className="h-3.5 w-3.5" />
                Car Configurator
              </div>
              <h1 className="mt-4 max-w-3xl text-3xl font-heading font-bold tracking-tight text-foreground sm:text-4xl">
                Configure the cabin, skin, extras, finance plan, and reserve your car in one flow.
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">
                Start with a live vehicle from inventory, personalize the exterior and interior, layer accessories, preview finance, and move straight into reservation.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: 'Live Models', value: vehicles.length || '—' },
                { label: 'Exterior Themes', value: exteriorOptions.length },
                { label: 'Extras', value: extrasOptions.length },
                { label: 'Accessories', value: accessoryOptions.length },
              ].map((stat) => (
                <div key={stat.label} className="rounded-2xl border border-border bg-background/80 px-4 py-3 shadow-sm">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{stat.label}</p>
                  <p className="mt-1 text-2xl font-heading font-bold text-foreground">{stat.value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="space-y-6">
            <Card className="overflow-hidden rounded-[2rem] border-border/70 shadow-card">
              <CardContent className="grid gap-0 p-0 lg:grid-cols-[0.95fr_1.05fr]">
                <div className="relative min-h-[320px] bg-gradient-to-br from-slate-100 via-white to-amber-50 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800">
                  {selectedVehicle ? (
                    <>
                      <VehicleImage
                        imageUrl={selectedVehicle.image_url}
                        brand={selectedVehicle.brand}
                        model={selectedVehicle.model}
                        className="h-full w-full object-cover"
                      />
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent p-5 text-white">
                        <p className="text-[11px] uppercase tracking-[0.18em] text-white/70">{selectedVehicle.year || 'Latest'} Edition</p>
                        <h2 className="mt-1 text-2xl font-heading font-bold">{selectedVehicle.brand} {selectedVehicle.model}</h2>
                        <p className="text-sm text-white/80">{selectedVehicle.variant || 'Signature Series'} • {selectedVehicle.locations?.name || 'Showroom allocation pending'}</p>
                      </div>
                    </>
                  ) : (
                    <div className="flex h-full items-center justify-center text-muted-foreground">Choose a vehicle to start configuring.</div>
                  )}
                </div>

                <div className="space-y-4 p-5 sm:p-6">
                  <div className="flex flex-wrap gap-2">
                    <Badge className="border border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
                      <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Live inventory
                    </Badge>
                    <Badge variant="secondary" className="bg-primary/10 text-primary">{selectedVehicle?.horsepower ? `${selectedVehicle.horsepower} HP` : 'Performance ready'}</Badge>
                    <Badge variant="secondary" className="bg-primary/10 text-primary">{selectedVehicle?.range_km ? `${selectedVehicle.range_km} km range` : 'Flexible powertrain'}</Badge>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-2xl border border-border bg-muted/20 p-3">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Base Price</p>
                      <p className="mt-1 text-lg font-semibold text-foreground">{basePrice ? formatCurrency(basePrice) : 'On Request'}</p>
                    </div>
                    <div className="rounded-2xl border border-border bg-muted/20 p-3">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Seats</p>
                      <p className="mt-1 text-lg font-semibold text-foreground">{selectedVehicle?.seating_capacity || '—'}</p>
                    </div>
                    <div className="rounded-2xl border border-border bg-muted/20 p-3">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Signature Finish</p>
                      <p className="mt-1 text-lg font-semibold text-foreground">{selectedExterior.name}</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <Button className="gap-2 rounded-xl" onClick={handleReserve} disabled={!selectedVehicle}>
                      Reserve Car
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      className="rounded-xl"
                      onClick={() => selectedVehicle && navigateTo(`/compare?ids=${encodeURIComponent(selectedVehicle.id)}`)}
                      disabled={!selectedVehicle}
                    >
                      Compare This Model
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-[2rem] border-border/70 shadow-card">
              <CardContent className="p-5 sm:p-6">
                <div className="mb-4 flex items-center gap-2">
                  <CarFront className="h-5 w-5 text-primary" />
                  <h3 className="text-lg font-heading font-semibold text-foreground">Choose Your Model</h3>
                </div>
                {loading ? (
                  <div className="rounded-2xl border border-dashed border-border bg-muted/30 px-4 py-10 text-center text-sm text-muted-foreground">
                    Loading live vehicle inventory...
                  </div>
                ) : (
                  <div className="grid gap-3 md:grid-cols-2">
                    {vehicles.map((vehicle) => {
                      const isActive = vehicle.id === selectedVehicleId;
                      return (
                        <button
                          key={vehicle.id}
                          type="button"
                          onClick={() => setSelectedVehicleId(vehicle.id)}
                          className={`rounded-2xl border p-4 text-left transition ${isActive ? 'border-primary bg-primary/5 ring-1 ring-primary/25' : 'border-border bg-background hover:border-primary/40 hover:bg-primary/5'}`}
                        >
                          <div className="flex items-center gap-3">
                            <VehicleImage imageUrl={vehicle.image_url} brand={vehicle.brand} model={vehicle.model} className="h-16 w-20 rounded-xl object-cover border border-border" />
                            <div className="min-w-0">
                              <p className="font-semibold text-foreground">{vehicle.brand} {vehicle.model}</p>
                              <p className="truncate text-sm text-muted-foreground">{vehicle.variant || 'Signature Variant'}</p>
                              <p className="mt-1 text-sm font-medium text-primary">{Number(vehicle.set_price || vehicle.price || 0) ? formatCurrency(Number(vehicle.set_price || vehicle.price || 0)) : 'Price on request'}</p>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="grid gap-6 lg:grid-cols-2">
              <Card className="rounded-[2rem] border-border/70 shadow-card">
                <CardContent className="p-5 sm:p-6">
                  <div className="mb-4 flex items-center gap-2">
                    <Palette className="h-5 w-5 text-primary" />
                    <h3 className="text-lg font-heading font-semibold text-foreground">Exterior</h3>
                  </div>
                  <div className="space-y-3">
                    {exteriorOptions.map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => setSelectedExteriorId(option.id)}
                        className={`flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition ${selectedExteriorId === option.id ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/30'}`}
                      >
                        <span className="h-11 w-11 rounded-full border border-white/70 shadow-sm" style={{ background: option.swatch }} />
                        <span className="min-w-0 flex-1">
                          <span className="block font-semibold text-foreground">{option.name}</span>
                          <span className="block text-sm text-muted-foreground">{option.detail}</span>
                        </span>
                        <span className="text-sm font-semibold text-primary">{option.price ? formatCurrency(option.price) : 'Included'}</span>
                      </button>
                    ))}

                    <div className="rounded-2xl border border-border bg-muted/20 p-3">
                      <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground"><CircleDot className="h-4 w-4 text-primary" /> Wheel package</p>
                      <div className="grid gap-2">
                        {wheelOptions.map((option) => (
                          <button
                            key={option.id}
                            type="button"
                            onClick={() => setSelectedWheelId(option.id)}
                            className={`rounded-xl border px-3 py-2 text-left transition ${selectedWheelId === option.id ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/30'}`}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <p className="font-medium text-foreground">{option.name}</p>
                                <p className="text-sm text-muted-foreground">{option.detail}</p>
                              </div>
                              <span className="text-sm font-semibold text-primary">{option.price ? formatCurrency(option.price) : 'Included'}</span>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-[2rem] border-border/70 shadow-card">
                <CardContent className="p-5 sm:p-6">
                  <div className="mb-4 flex items-center gap-2">
                    <Sofa className="h-5 w-5 text-primary" />
                    <h3 className="text-lg font-heading font-semibold text-foreground">Interior</h3>
                  </div>
                  <div className="space-y-3">
                    {interiorOptions.map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => setSelectedInteriorId(option.id)}
                        className={`w-full rounded-2xl border p-4 text-left transition ${selectedInteriorId === option.id ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/30'}`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="font-semibold text-foreground">{option.name}</p>
                            <p className="text-sm text-muted-foreground">{option.detail}</p>
                          </div>
                          <span className="text-sm font-semibold text-primary">{option.price ? formatCurrency(option.price) : 'Included'}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <Card className="rounded-[2rem] border-border/70 shadow-card">
                <CardContent className="p-5 sm:p-6">
                  <div className="mb-4 flex items-center gap-2">
                    <Layers3 className="h-5 w-5 text-primary" />
                    <h3 className="text-lg font-heading font-semibold text-foreground">Extras</h3>
                  </div>
                  <div className="space-y-3">
                    {extrasOptions.map((option) => {
                      const checked = selectedExtras.includes(option.id);
                      return (
                        <label key={option.id} className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-3 transition ${checked ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/30'}`}>
                          <Checkbox checked={checked} onCheckedChange={() => toggleSelection(option.id, selectedExtras, setSelectedExtras)} className="mt-1" />
                          <span className="min-w-0 flex-1">
                            <span className="flex items-center justify-between gap-3">
                              <span className="font-semibold text-foreground">{option.name}</span>
                              <span className="text-sm font-semibold text-primary">{formatCurrency(option.price)}</span>
                            </span>
                            <span className="mt-1 block text-sm text-muted-foreground">{option.detail}</span>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-[2rem] border-border/70 shadow-card">
                <CardContent className="p-5 sm:p-6">
                  <div className="mb-4 flex items-center gap-2">
                    <Wrench className="h-5 w-5 text-primary" />
                    <h3 className="text-lg font-heading font-semibold text-foreground">Accessories</h3>
                  </div>
                  <div className="space-y-3">
                    {accessoryOptions.map((option) => {
                      const checked = selectedAccessories.includes(option.id);
                      return (
                        <label key={option.id} className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-3 transition ${checked ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/30'}`}>
                          <Checkbox checked={checked} onCheckedChange={() => toggleSelection(option.id, selectedAccessories, setSelectedAccessories)} className="mt-1" />
                          <span className="min-w-0 flex-1">
                            <span className="flex items-center justify-between gap-3">
                              <span className="font-semibold text-foreground">{option.name}</span>
                              <span className="text-sm font-semibold text-primary">{formatCurrency(option.price)}</span>
                            </span>
                            <span className="mt-1 block text-sm text-muted-foreground">{option.detail}</span>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          <div className="space-y-6 xl:sticky xl:top-24 xl:self-start">
            <Card className="rounded-[2rem] border-border/70 shadow-card">
              <CardContent className="p-5 sm:p-6">
                <div className="mb-4 flex items-center gap-2">
                  <BadgeIndianRupee className="h-5 w-5 text-primary" />
                  <h3 className="text-lg font-heading font-semibold text-foreground">Finance Calculator</h3>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="down-payment">Down payment</Label>
                    <Input id="down-payment" value={downPayment} onChange={(event) => setDownPayment(event.target.value)} placeholder="250000" />
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="interest-rate">Interest rate (%)</Label>
                      <Input id="interest-rate" value={interestRate} onChange={(event) => setInterestRate(event.target.value)} placeholder="8.75" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="term-months">Loan term</Label>
                      <Select value={termMonths} onValueChange={setTermMonths}>
                        <SelectTrigger id="term-months"><SelectValue placeholder="Term" /></SelectTrigger>
                        <SelectContent>
                          {financeTerms.map((term) => (
                            <SelectItem key={term} value={String(term)}>{term} months</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 dark:border-emerald-900/60 dark:bg-emerald-950/20">
                    <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-300">Estimated EMI</p>
                    <p className="mt-2 text-3xl font-heading font-bold text-emerald-800 dark:text-emerald-200">{formatCurrency(estimatedMonthly || 0)}</p>
                    <p className="mt-1 text-sm text-emerald-700/80 dark:text-emerald-300/80">Based on selected configuration, {termMonths} month term, and {interestRate}% annual rate.</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-[2rem] border-border/70 shadow-card">
              <CardContent className="p-5 sm:p-6">
                <div className="mb-4 flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-primary" />
                  <h3 className="text-lg font-heading font-semibold text-foreground">Build Summary</h3>
                </div>

                <div className="space-y-4">
                  <div className="rounded-2xl border border-border bg-muted/20 p-4">
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="text-muted-foreground">Base vehicle</span>
                      <span className="font-semibold text-foreground">{basePrice ? formatCurrency(basePrice) : 'On request'}</span>
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-3 text-sm">
                      <span className="text-muted-foreground">Configuration total</span>
                      <span className="font-semibold text-foreground">{formatCurrency(optionsTotal)}</span>
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-3 text-sm">
                      <span className="text-muted-foreground">Financed amount</span>
                      <span className="font-semibold text-foreground">{formatCurrency(financedAmount)}</span>
                    </div>
                    <div className="mt-4 border-t border-border pt-4">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm font-medium text-muted-foreground">Drive-away estimate</span>
                        <span className="text-2xl font-heading font-bold text-foreground">{formatCurrency(subtotal)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3 rounded-2xl border border-border bg-background p-4">
                    <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Selected configuration</p>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-start justify-between gap-3"><span className="text-muted-foreground">Exterior</span><span className="text-right font-medium text-foreground">{selectedExterior.name}</span></div>
                      <div className="flex items-start justify-between gap-3"><span className="text-muted-foreground">Wheels</span><span className="text-right font-medium text-foreground">{selectedWheel.name}</span></div>
                      <div className="flex items-start justify-between gap-3"><span className="text-muted-foreground">Interior</span><span className="text-right font-medium text-foreground">{selectedInterior.name}</span></div>
                      <div className="flex items-start justify-between gap-3"><span className="text-muted-foreground">Extras</span><span className="text-right font-medium text-foreground">{chosenExtras.length ? chosenExtras.map((option) => option.name).join(', ') : 'None'}</span></div>
                      <div className="flex items-start justify-between gap-3"><span className="text-muted-foreground">Accessories</span><span className="text-right font-medium text-foreground">{chosenAccessories.length ? chosenAccessories.map((option) => option.name).join(', ') : 'None'}</span></div>
                    </div>
                  </div>

                  <div className="grid gap-3">
                    <Button className="gap-2 rounded-xl" onClick={handleReserve} disabled={!selectedVehicle}>
                      Reserve Car
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" className="rounded-xl" onClick={() => navigateTo('/compare')}>
                      Explore More Vehicles
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}