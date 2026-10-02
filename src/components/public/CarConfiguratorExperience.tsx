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
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import VehicleImage from '@/components/common/VehicleImage';
import {
  ArrowRight,
  BadgeIndianRupee,
  CarFront,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CircleDot,
  Layers3,
  Palette,
  ShieldCheck,
  Sofa,
  Sparkles,
  Wrench,
  GitCompareArrows,
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

const interiorColorById: Record<string, string> = {
  obsidian: '#1f2937',
  sandstone: '#c4a484',
  oxblood: '#7f1d1d',
};

const brandVisualTheme: Record<string, { exteriorOpacity: number; interiorOpacity: number; glow: string }> = {
  toyota: {
    exteriorOpacity: 0.2,
    interiorOpacity: 0.18,
    glow: 'radial-gradient(circle at 82% 18%, rgba(239,68,68,0.35), transparent 45%)',
  },
  lexus: {
    exteriorOpacity: 0.26,
    interiorOpacity: 0.22,
    glow: 'radial-gradient(circle at 18% 20%, rgba(56,189,248,0.30), transparent 48%)',
  },
  default: {
    exteriorOpacity: 0.18,
    interiorOpacity: 0.16,
    glow: 'radial-gradient(circle at 70% 20%, rgba(99,102,241,0.24), transparent 50%)',
  },
};

const financeTerms = [24, 36, 48, 60, 72];
const MAX_COMPARE = 4;

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

const getVehiclePrice = (vehicle: ConfigVehicle | null) => Number(vehicle?.set_price || vehicle?.price || 0);

const brandOrderPriority = ['toyota', 'lexus'];

const sortVehiclesForDisplay = (list: ConfigVehicle[]) => {
  return [...list].sort((a, b) => {
    const aBrand = (a.brand || '').toLowerCase();
    const bBrand = (b.brand || '').toLowerCase();

    const aRank = brandOrderPriority.indexOf(aBrand);
    const bRank = brandOrderPriority.indexOf(bBrand);

    const normalizedARank = aRank === -1 ? Number.MAX_SAFE_INTEGER : aRank;
    const normalizedBRank = bRank === -1 ? Number.MAX_SAFE_INTEGER : bRank;

    if (normalizedARank !== normalizedBRank) return normalizedARank - normalizedBRank;

    const brandCompare = aBrand.localeCompare(bBrand);
    if (brandCompare !== 0) return brandCompare;

    return (a.model || '').toLowerCase().localeCompare((b.model || '').toLowerCase());
  });
};

const formatPriceBadge = (value: number) => {
  if (!Number.isFinite(value) || value <= 0) return 'Price on request';
  if (value >= 10000000) return `₹${(value / 10000000).toFixed(2)} Cr`;
  if (value >= 100000) return `₹${(value / 100000).toFixed(2)} L`;
  return formatCurrency(value);
};

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
  const [showBottomPanel, setShowBottomPanel] = useState(true);
  const [visualPulse, setVisualPulse] = useState(false);
  const [compareVehicleIds, setCompareVehicleIds] = useState<string[]>([]);
  const [showCompareCanvas, setShowCompareCanvas] = useState(false);
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

        const orderedVehicles = sortVehiclesForDisplay(mergedVehicles);

        setVehicles(orderedVehicles);
        const searchVehicleId = normalizeSearchVehicleId();
        const initialVehicle = orderedVehicles.find((vehicle) => vehicle.id === searchVehicleId) || orderedVehicles[0] || null;
        setSelectedVehicleId(initialVehicle?.id || null);
      } catch (error) {
        if (cancelled) return;
        console.error('Failed to load live inventory for configurator', error);
        const orderedStaticVehicles = sortVehiclesForDisplay(staticCatalogVehicles);
        setVehicles(orderedStaticVehicles);
        setSelectedVehicleId(orderedStaticVehicles[0]?.id || null);
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
  const selectedBrandKey = (selectedVehicle?.brand || '').toLowerCase();
  const selectedBrandTheme = brandVisualTheme[selectedBrandKey] || brandVisualTheme.default;
  const selectedInteriorColor = interiorColorById[selectedInterior.id] || '#334155';
  const selectedCompareVehicles = useMemo(
    () => compareVehicleIds
      .map((id) => vehicles.find((vehicle) => vehicle.id === id) || null)
      .filter((vehicle): vehicle is ConfigVehicle => Boolean(vehicle)),
    [compareVehicleIds, vehicles],
  );

  const basePrice = getVehiclePrice(selectedVehicle);
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

  const toggleCompareVehicle = (vehicleId: string) => {
    setCompareVehicleIds((prev) => {
      if (prev.includes(vehicleId)) return prev.filter((id) => id !== vehicleId);
      if (prev.length >= MAX_COMPARE) return prev;
      return [...prev, vehicleId];
    });
  };

  const openCompareCanvas = () => {
    if (!selectedVehicle) return;
    setCompareVehicleIds((prev) => {
      if (prev.includes(selectedVehicle.id)) return prev;
      if (prev.length >= MAX_COMPARE) return prev;
      return [...prev, selectedVehicle.id];
    });
    setShowCompareCanvas(true);
  };

  const handleReserve = () => {
    if (!selectedVehicle) return;
    const modelName = encodeURIComponent(`${selectedVehicle.brand} ${selectedVehicle.model}`);
    navigateTo(`/book?vehicleId=${encodeURIComponent(selectedVehicle.id)}&modelName=${modelName}`);
  };

  useEffect(() => {
    setVisualPulse(true);
    const timer = setTimeout(() => setVisualPulse(false), 320);
    return () => clearTimeout(timer);
  }, [selectedVehicleId, selectedExteriorId, selectedInteriorId]);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(15,118,110,0.16),_transparent_30%),radial-gradient(circle_at_top_right,_rgba(249,115,22,0.12),_transparent_24%),linear-gradient(180deg,hsl(var(--background)),hsl(var(--muted)/0.25))]">
      <div className="mx-auto max-w-7xl px-4 py-8 pb-40 sm:px-6 lg:px-8 lg:py-10 lg:pb-48">
        <div className="mb-3 rounded-[2rem] border border-border/60 bg-card/85 p-4 shadow-card backdrop-blur sm:p-4">
          <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr] lg:items-end">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.24em] text-primary shadow-sm">
                <Sparkles className="h-3.5 w-3.5" />
                Car Configurator
              </div>
              <h1 className="mt-4 max-w-3xl text-2xl font-heading font-extrabold tracking-tight text-foreground sm:text-2xl">
                Configure Your Car
              </h1>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {[
                { label: 'Live Models', value: vehicles.length || '—', note: 'Available to configure', icon: CarFront, tone: 'text-rose-600 bg-rose-50 border-rose-200 dark:text-rose-300 dark:bg-rose-950/40 dark:border-rose-900/70' },
                { label: 'Exterior Themes', value: exteriorOptions.length, note: 'Paint options', icon: Palette, tone: 'text-indigo-600 bg-indigo-50 border-indigo-200 dark:text-indigo-300 dark:bg-indigo-950/40 dark:border-indigo-900/70' },
                { label: 'Extras', value: extrasOptions.length, note: 'Feature packs', icon: Layers3, tone: 'text-emerald-600 bg-emerald-50 border-emerald-200 dark:text-emerald-300 dark:bg-emerald-950/40 dark:border-emerald-900/70' },
                { label: 'Accessories', value: accessoryOptions.length, note: 'Add-ons', icon: Wrench, tone: 'text-amber-600 bg-amber-50 border-amber-200 dark:text-amber-300 dark:bg-amber-950/40 dark:border-amber-900/70' },
              ].map((stat) => {
                const StatIcon = stat.icon;
                return (
                  <div key={stat.label} className="rounded-2xl border border-border bg-background/90 px-4 py-3 shadow-sm">
                  
                    <p className="text-3xl font-heading font-extrabold leading-none text-foreground">{stat.value}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{stat.note}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[0.38fr_0.9fr_0.72fr]">
          <div className="xl:sticky xl:top-24 xl:h-[calc(100vh-7rem)]">
            <Card className="flex h-full flex-col overflow-hidden rounded-[2rem] border-border/70 shadow-card">
              <CardContent className="flex h-full flex-col p-0">
                <div className="border-b border-border/70 px-5 py-4">
                  <div className="mb-1 flex items-center gap-2">
                    <CarFront className="h-5 w-5 text-primary" />
                    <h3 className="text-lg font-heading font-semibold text-foreground">All Models</h3>
                  </div>
                  <p className="text-xs text-muted-foreground">Scroll to explore all available models, grades, and prices.</p>
                </div>

                {loading ? (
                  <div className="px-5 py-8 text-sm text-muted-foreground">Loading models...</div>
                ) : (
                  <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
                    {vehicles.map((vehicle) => {
                      const isActive = vehicle.id === selectedVehicleId;
                      const vehiclePrice = getVehiclePrice(vehicle);
                      return (
                        <button
                          key={vehicle.id}
                          type="button"
                          onClick={() => setSelectedVehicleId(vehicle.id)}
                          className={`w-full rounded-2xl border p-3 text-left transition ${isActive ? 'border-primary bg-primary/5 ring-1 ring-primary/30' : 'border-border bg-background hover:border-primary/40 hover:bg-primary/5'}`}
                        >
                          <div className="flex items-center gap-3">
                            <div className="min-w-0 flex-1">
                              <p className="whitespace-normal break-words text-sm font-semibold leading-5 text-foreground">{vehicle.brand} {vehicle.model}</p>
                              <p className="mt-0.5 whitespace-normal break-words text-xs leading-4 text-foreground/80">Grade: {vehicle.variant || 'Standard'}</p>
                             
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6 xl:max-h-[calc(100vh-7rem)] xl:overflow-y-auto xl:pr-1">
            <Card className="overflow-hidden rounded-[2rem] border-border/70">
              <CardContent className="p-0">
                <div className="flex items-center justify-between gap-3 border-b border-border/70 px-5 py-4 sm:px-6">
                  <div className="min-w-0 pr-2">
                    <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Selected model</p>
                    <p className="whitespace-normal break-words text-base font-semibold text-foreground">{selectedVehicle ? `${selectedVehicle.brand} ${selectedVehicle.model}` : 'Choose a model'}</p>
                  </div>
                  <Button
                    variant="outline"
                    className="rounded-xl"
                    onClick={openCompareCanvas}
                    disabled={!selectedVehicle}
                  >
                    Compare In Canvas
                  </Button>
                </div>

                <div className="relative min-h-[360px] overflow-hidden bg-gradient-to-br from-slate-100 via-white to-amber-50 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800">
                  {selectedVehicle ? (
                    <>
                      <VehicleImage
                        imageUrl={selectedVehicle.image_url}
                        brand={selectedVehicle.brand}
                        model={selectedVehicle.model}
                        className={`h-full w-full object-cover transition-all duration-500 ${visualPulse ? 'scale-[1.02]' : 'scale-100'}`}
                      />

                      <div
                        className="pointer-events-none absolute inset-0 transition-opacity duration-500"
                        style={{
                          background: selectedExterior.swatch,
                          opacity: selectedBrandTheme.exteriorOpacity,
                          mixBlendMode: 'multiply',
                        }}
                      />
                      <div
                        className="pointer-events-none absolute inset-0 transition-opacity duration-500"
                        style={{
                          background: `linear-gradient(180deg, transparent 35%, ${selectedInteriorColor} 100%)`,
                          opacity: selectedBrandTheme.interiorOpacity,
                          mixBlendMode: 'overlay',
                        }}
                      />
                      <div
                        className="pointer-events-none absolute inset-0 transition-opacity duration-500"
                        style={{
                          background: selectedBrandTheme.glow,
                          opacity: visualPulse ? 1 : 0.72,
                        }}
                      />

                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent p-5 text-white sm:p-6">
                        <p className="text-[11px] uppercase tracking-[0.18em] text-white/70">{selectedVehicle.year || 'Latest'} Edition</p>
                        <h2 className="mt-1 text-2xl font-heading font-bold sm:text-3xl">{selectedVehicle.brand} {selectedVehicle.model}</h2>
                        <p className="text-sm text-white/90">{selectedVehicle.locations?.name || 'Showroom allocation pending'}</p>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <span className="inline-flex items-center rounded-full border border-white/35 bg-black/20 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-white">
                            Grade: {selectedVehicle.variant || 'Signature Series'}
                          </span>
                          <span className="inline-flex items-center rounded-full border border-white/35 bg-black/20 px-3 py-1 text-xs font-semibold text-white">
                            Exterior: {selectedExterior.name}
                          </span>
                          <span className="inline-flex items-center rounded-full border border-white/35 bg-black/20 px-3 py-1 text-xs font-semibold text-white">
                            Interior: {selectedInterior.name}
                          </span>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="flex h-full items-center justify-center text-muted-foreground">Choose a vehicle to start configuring.</div>
                  )}
                </div>

                <div className="border-t border-border/70 px-5 py-4 sm:px-6">
                  <p className="mb-3 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Model image scroller</p>
                  <div className="flex gap-2 overflow-x-auto pb-2">
                    {vehicles.map((vehicle) => {
                      const isActive = vehicle.id === selectedVehicleId;
                      return (
                        <button
                          key={`thumb-${vehicle.id}`}
                          type="button"
                          onClick={() => setSelectedVehicleId(vehicle.id)}
                          className={`relative h-20 w-28 shrink-0 overflow-hidden rounded-xl border transition ${isActive ? 'border-primary ring-2 ring-primary/30' : 'border-border hover:border-primary/40'}`}
                        >
                          <VehicleImage
                            imageUrl={vehicle.image_url}
                            brand={vehicle.brand}
                            model={vehicle.model}
                            className="h-full w-full object-cover"
                          />
                        </button>
                      );
                    })}
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <Badge className="border border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
                      <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Live inventory
                    </Badge>
                    <Badge variant="secondary" className="bg-primary/10 text-primary">{selectedVehicle?.horsepower ? `${selectedVehicle.horsepower} HP` : 'Performance ready'}</Badge>
                    <Badge variant="secondary" className="bg-primary/10 text-primary">{selectedVehicle?.range_km ? `${selectedVehicle.range_km} km range` : 'Flexible powertrain'}</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-border bg-muted/20 p-3">
                <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Base Price</p>
                <p className="mt-1 text-xl font-bold text-foreground">{formatPriceBadge(basePrice)}</p>
                <p className="text-[11px] text-muted-foreground">{basePrice ? `${formatCurrency(basePrice)} ex-showroom` : 'Estimated pricing available on enquiry'}</p>
              </div>
              <div className="rounded-2xl border border-border bg-muted/20 p-3">
                <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Seats</p>
                <p className="mt-1 text-lg font-semibold text-foreground">{selectedVehicle?.seating_capacity || '—'}</p>
              </div>
              <div className="rounded-2xl border border-border bg-muted/20 p-3">
                <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Grade</p>
                <p className="mt-1 text-lg font-semibold text-foreground">{selectedVehicle?.variant || 'Standard'}</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button className="gap-2 rounded-xl" onClick={handleReserve} disabled={!selectedVehicle}>
                Reserve Car
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="space-y-6 xl:max-h-[calc(100vh-7rem)] xl:overflow-y-auto xl:pr-1">
            <Card className="rounded-[2rem] border-border/70 shadow-card">
              <CardContent className="p-5 sm:p-6">
                <div className="mb-4 flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-primary" />
                  <h3 className="text-lg font-heading font-semibold text-foreground">Grade & Cabin</h3>
                </div>
                <div className="space-y-3">
                  <div className="rounded-2xl border border-border bg-muted/20 p-3">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Selected Grade</p>
                    <p className="mt-1 text-base font-semibold text-foreground">{selectedVehicle?.variant || 'Standard'}</p>
                  </div>

                  <div className="space-y-2">
                    {interiorOptions.map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => setSelectedInteriorId(option.id)}
                        className={`w-full rounded-xl border p-3 text-left transition ${selectedInteriorId === option.id ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/30'}`}
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
                </div>
              </CardContent>
            </Card>

            <div className="grid gap-6 lg:grid-cols-1">
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
            </div>

            <div className="grid gap-6 lg:grid-cols-1">
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
            </div>

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
      </div>

      <div className="fixed inset-x-0 bottom-0 z-40 px-3 pb-3 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl rounded-2xl border border-border/70 bg-slate-950/95 shadow-[0_-18px_50px_rgba(15,23,42,0.28)] backdrop-blur dark:bg-slate-950/95">
          <button
            type="button"
            onClick={() => setShowBottomPanel((prev) => !prev)}
            className="flex w-full items-center justify-between gap-3 border-b border-border/70 px-4 py-3 text-left"
          >
            <div>
              <p className="text-[11px] uppercase tracking-[0.16em] text-slate-300">Quick finance & summary</p>
              <p className="text-sm font-semibold text-white">Finance Calculator + Build Summary</p>
            </div>
            <span className="inline-flex items-center gap-1 rounded-full border border-slate-600 px-2.5 py-1 text-xs font-medium text-slate-100">
              {showBottomPanel ? 'Hide' : 'Show'}
              {showBottomPanel ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
            </span>
          </button>

          {showBottomPanel && (
            <div className="max-h-[60vh] overflow-y-auto p-4 sm:p-5">
              <div className="grid gap-4 xl:grid-cols-2">
                <Card className="rounded-[1.25rem] border-emerald-400/40 bg-emerald-50/95 shadow-none dark:bg-emerald-950/35">
                  <CardContent className="p-4 sm:p-5">
                    <div className="mb-3 flex items-center gap-2">
                      <BadgeIndianRupee className="h-4 w-4 text-emerald-700 dark:text-emerald-300" />
                      <h3 className="text-base font-heading font-semibold text-emerald-900 dark:text-emerald-100">Finance Calculator</h3>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="space-y-1.5 sm:col-span-1">
                        <Label htmlFor="down-payment" className="text-xs text-emerald-900/75 dark:text-emerald-200/80">Down payment</Label>
                        <Input id="down-payment" value={downPayment} onChange={(event) => setDownPayment(event.target.value)} placeholder="250000" className="h-9" />
                      </div>
                      <div className="space-y-1.5 sm:col-span-1">
                        <Label htmlFor="interest-rate" className="text-xs text-emerald-900/75 dark:text-emerald-200/80">Interest %</Label>
                        <Input id="interest-rate" value={interestRate} onChange={(event) => setInterestRate(event.target.value)} placeholder="8.75" className="h-9" />
                      </div>
                      <div className="space-y-1.5 sm:col-span-1">
                        <Label htmlFor="term-months" className="text-xs text-emerald-900/75 dark:text-emerald-200/80">Term</Label>
                        <Select value={termMonths} onValueChange={setTermMonths}>
                          <SelectTrigger id="term-months" className="h-9"><SelectValue placeholder="Term" /></SelectTrigger>
                          <SelectContent>
                            {financeTerms.map((term) => (
                              <SelectItem key={term} value={String(term)}>{term} months</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="mt-3 rounded-xl border border-emerald-300 bg-white/80 p-3 dark:border-emerald-800 dark:bg-emerald-950/30">
                      <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-emerald-700 dark:text-emerald-300">Estimated EMI</p>
                      <p className="mt-1 text-2xl font-heading font-bold text-emerald-800 dark:text-emerald-200">{formatCurrency(estimatedMonthly || 0)}</p>
                      <p className="mt-1 text-xs text-emerald-700/80 dark:text-emerald-300/80">{termMonths} months at {interestRate}% annual rate</p>
                    </div>
                  </CardContent>
                </Card>

                <Card className="rounded-[1.25rem] border-sky-400/40 bg-sky-50/95 shadow-none dark:bg-sky-950/30">
                  <CardContent className="p-4 sm:p-5">
                    <div className="mb-3 flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4 text-sky-700 dark:text-sky-300" />
                      <h3 className="text-base font-heading font-semibold text-sky-900 dark:text-sky-100">Build Summary</h3>
                    </div>

                    <div className="rounded-xl border border-sky-200 bg-white/80 p-3 dark:border-sky-800 dark:bg-sky-950/25">
                      <div className="grid gap-2 text-sm sm:grid-cols-2">
                        <div className="flex items-center justify-between gap-2 sm:block">
                          <p className="text-xs text-sky-900/70 dark:text-sky-200/75">Base vehicle</p>
                          <p className="font-semibold text-foreground">{basePrice ? formatCurrency(basePrice) : 'On request'}</p>
                        </div>
                        <div className="flex items-center justify-between gap-2 sm:block">
                          <p className="text-xs text-sky-900/70 dark:text-sky-200/75">Config total</p>
                          <p className="font-semibold text-foreground">{formatCurrency(optionsTotal)}</p>
                        </div>
                        <div className="flex items-center justify-between gap-2 sm:block">
                          <p className="text-xs text-sky-900/70 dark:text-sky-200/75">Financed</p>
                          <p className="font-semibold text-foreground">{formatCurrency(financedAmount)}</p>
                        </div>
                        <div className="rounded-lg bg-sky-100/80 p-2 sm:text-right dark:bg-sky-900/40">
                          <p className="text-[10px] uppercase tracking-[0.12em] text-sky-900/75 dark:text-sky-200/75">Drive-away</p>
                          <p className="text-lg font-heading font-bold text-foreground">{formatCurrency(subtotal)}</p>
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 grid gap-2 rounded-xl border border-border bg-background p-3 text-sm sm:grid-cols-2">
                      <div className="flex items-center justify-between gap-2"><span className="text-muted-foreground">Exterior</span><span className="font-medium text-foreground">{selectedExterior.name}</span></div>
                      <div className="flex items-center justify-between gap-2"><span className="text-muted-foreground">Wheels</span><span className="font-medium text-foreground">{selectedWheel.name}</span></div>
                      <div className="flex items-center justify-between gap-2"><span className="text-muted-foreground">Interior</span><span className="font-medium text-foreground">{selectedInterior.name}</span></div>
                      <div className="flex items-center justify-between gap-2"><span className="text-muted-foreground">Extras</span><span className="font-medium text-foreground">{chosenExtras.length || 0}</span></div>
                      <div className="flex items-center justify-between gap-2 sm:col-span-2"><span className="text-muted-foreground">Accessories</span><span className="font-medium text-foreground">{chosenAccessories.length || 0}</span></div>
                    </div>

                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      <Button className="gap-2 rounded-xl" onClick={handleReserve} disabled={!selectedVehicle}>
                        Reserve Car
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" className="rounded-xl" onClick={openCompareCanvas}>
                        Explore More
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </div>
      </div>

      <Sheet open={showCompareCanvas} onOpenChange={setShowCompareCanvas}>
        <SheetContent side="right" className="w-full max-w-[92vw] overflow-y-auto border-l border-border/70 p-0 sm:max-w-3xl">
          <SheetHeader className="border-b border-border/70 px-5 py-4 text-left sm:px-6">
            <SheetTitle className="text-base font-semibold text-foreground">Compare Your Drive</SheetTitle>
            <SheetDescription>View and compare your selected vehicles side by side.</SheetDescription>
          </SheetHeader>

          <div className="border-b border-border/70 px-5 py-4 sm:px-6">
            <div className="mb-2 flex items-center gap-2 text-sm font-medium text-foreground">
              <GitCompareArrows className="h-4 w-4 text-primary" />
              Pick up to {MAX_COMPARE} vehicles
            </div>
            <div className="flex flex-wrap gap-2">
              {vehicles.map((vehicle) => {
                const active = compareVehicleIds.includes(vehicle.id);
                const atLimit = !active && compareVehicleIds.length >= MAX_COMPARE;
                return (
                  <button
                    key={`compare-pick-${vehicle.id}`}
                    type="button"
                    onClick={() => toggleCompareVehicle(vehicle.id)}
                    disabled={atLimit}
                    className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${active ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-background text-foreground hover:border-primary/40'} ${atLimit ? 'cursor-not-allowed opacity-50' : ''}`}
                  >
                    {vehicle.brand} {vehicle.model}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="px-5 py-4 sm:px-6">
            {selectedCompareVehicles.length === 0 ? (
              <p className="text-sm text-muted-foreground">Choose at least one vehicle to start comparing.</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {selectedCompareVehicles.map((vehicle) => {
                  const vehiclePrice = getVehiclePrice(vehicle);
                  return (
                    <div key={`compare-card-${vehicle.id}`} className="overflow-hidden rounded-2xl border border-border bg-background">
                      <div className="h-36 w-full overflow-hidden">
                        <VehicleImage imageUrl={vehicle.image_url} brand={vehicle.brand} model={vehicle.model} className="h-full w-full object-cover" />
                      </div>
                      <div className="space-y-2 p-3">
                        <p className="text-sm font-semibold text-foreground">{vehicle.brand} {vehicle.model}</p>
                        <p className="text-xs text-muted-foreground">{vehicle.variant || 'Standard'} • {vehicle.year || 'Latest'}</p>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div className="rounded-lg border border-border/70 bg-muted/20 px-2 py-1.5">
                            <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Price</p>
                            <p className="font-semibold text-foreground">{formatPriceBadge(vehiclePrice)}</p>
                          </div>
                          <div className="rounded-lg border border-border/70 bg-muted/20 px-2 py-1.5">
                            <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Seats</p>
                            <p className="font-semibold text-foreground">{vehicle.seating_capacity || '—'}</p>
                          </div>
                          <div className="rounded-lg border border-border/70 bg-muted/20 px-2 py-1.5">
                            <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Power</p>
                            <p className="font-semibold text-foreground">{vehicle.horsepower ? `${vehicle.horsepower} HP` : '—'}</p>
                          </div>
                          <div className="rounded-lg border border-border/70 bg-muted/20 px-2 py-1.5">
                            <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Range</p>
                            <p className="font-semibold text-foreground">{vehicle.range_km ? `${vehicle.range_km} km` : '—'}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}