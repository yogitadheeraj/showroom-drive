import { useEffect, useMemo, useRef, useState } from 'react';
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
  Banknote,
  CarFront,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
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
  config_image_urls?: string[] | null;
  config_grades?: string[] | null;
  config_exterior_options?: Array<Record<string, unknown>> | null;
  config_interior_options?: Array<Record<string, unknown>> | null;
  config_extras_options?: Array<Record<string, unknown>> | null;
  config_accessories_options?: Array<Record<string, unknown>> | null;
  config_addons_options?: Array<Record<string, unknown>> | null;
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

const defaultExteriorOptions: SingleOption[] = [
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

const defaultInteriorOptions: SingleOption[] = [
  { id: 'obsidian', name: 'Obsidian Black', detail: 'Monotone cabin with satin chrome accents', price: 0 },
  { id: 'sandstone', name: 'Sandstone Beige', detail: 'Open-pore wood and warm ambient palette', price: 36000 },
  { id: 'oxblood', name: 'Oxblood Atelier', detail: 'Performance quilt with contrast piping', price: 52000 },
];

const defaultExtrasOptions: ToggleOption[] = [
  { id: 'adas', name: 'Autonomy Suite', detail: 'Adaptive cruise, lane-centering, 360 safety sensors', price: 145000 },
  { id: 'panoramic', name: 'Panoramic Glass Roof', detail: 'Electrochromic glass roof with solar tint', price: 96000 },
  { id: 'audio', name: 'Immersive 18-Speaker Audio', detail: 'Premium surround audio with active noise shaping', price: 88000 },
  { id: 'performance', name: 'Performance Boost', detail: 'Enhanced drive mode and dynamic chassis tune', price: 110000 },
];

const defaultAccessoryOptions: ToggleOption[] = [
  { id: 'charger', name: 'Home Charger Kit', detail: 'Smart wall box with app scheduling', price: 74000 },
  { id: 'protection', name: 'Protection Pack', detail: 'All-weather mats, sill guards, cargo liner', price: 18000 },
  { id: 'carrier', name: 'Roof Carrier System', detail: 'Low-profile modular crossbar package', price: 26000 },
  { id: 'dashcam', name: 'Dual Dashcam', detail: 'Front and rear event recording setup', price: 22000 },
];

const defaultAddonOptions: ToggleOption[] = [
  { id: 'ceramic-coating', name: 'Ceramic Coating', detail: '5-year paint and gloss protection', price: 22000 },
  { id: 'extended-warranty', name: 'Extended Warranty', detail: 'Additional 2-year comprehensive coverage', price: 30000 },
  { id: 'concierge', name: 'Concierge Pickup', detail: 'Doorstep pickup and return for servicing', price: 14000 },
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
const DISPLAY_LOCALE = 'en-AE';
const DISPLAY_CURRENCY = 'AED';
const NIGHT_FX_STORAGE_KEY = 'car-configurator-night-fx';

const formatCurrency = (value: number) =>
  new Intl.NumberFormat(DISPLAY_LOCALE, {
    style: 'currency',
    currency: DISPLAY_CURRENCY,
    maximumFractionDigits: 0,
  }).format(Number.isFinite(value) ? value : 0);

const normalizeSearchVehicleId = () => {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  return params.get('vehicleId') || null;
};

const parseCurrencyNumber = (value: string) => Number(value.replace(/[^0-9.]/g, '')) || 0;

const getVehiclePrice = (vehicle: ConfigVehicle | null) => Number(vehicle?.set_price || vehicle?.price || 0);

const normalizeStringList = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => String(entry || '').trim()).filter(Boolean);
};

const toOptionId = (value: string, fallback: string) => {
  const normalized = value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  return normalized || fallback;
};

const normalizeSingleOptions = (value: unknown, fallback: SingleOption[]): SingleOption[] => {
  if (!Array.isArray(value) || value.length === 0) return fallback;
  const parsed = value.reduce<SingleOption[]>((acc, entry, index) => {
      const record = entry as Record<string, unknown>;
      const name = String(record?.name || '').trim();
      if (!name) return acc;
      acc.push({
        id: String(record?.id || toOptionId(name, `option-${index + 1}`)),
        name,
        detail: String(record?.detail || '').trim(),
        price: Number(record?.price || 0) || 0,
        swatch: record?.swatch ? String(record.swatch) : undefined,
      });
      return acc;
    }, []);
  return parsed.length ? parsed : fallback;
};

const normalizeToggleOptions = (value: unknown, fallback: ToggleOption[]): ToggleOption[] => {
  if (!Array.isArray(value) || value.length === 0) return fallback;
  const parsed = value.reduce<ToggleOption[]>((acc, entry, index) => {
      const record = entry as Record<string, unknown>;
      const name = String(record?.name || '').trim();
      if (!name) return acc;
      acc.push({
        id: String(record?.id || toOptionId(name, `option-${index + 1}`)),
        name,
        detail: String(record?.detail || '').trim(),
        price: Number(record?.price || 0) || 0,
      });
      return acc;
    }, []);
  return parsed.length ? parsed : fallback;
};

const getPrimaryVehicleImage = (vehicle: ConfigVehicle | null) => {
  if (!vehicle) return null;
  const gallery = normalizeStringList(vehicle.config_image_urls);
  return gallery[0] || vehicle.image_url || null;
};

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
  if (value >= 1000000) {
    return new Intl.NumberFormat(DISPLAY_LOCALE, {
      style: 'currency',
      currency: DISPLAY_CURRENCY,
      notation: 'compact',
      compactDisplay: 'short',
      maximumFractionDigits: 1,
    }).format(value);
  }
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
  const [selectedExteriorId, setSelectedExteriorId] = useState(defaultExteriorOptions[0].id);
  const [selectedWheelId, setSelectedWheelId] = useState(wheelOptions[0].id);
  const [selectedInteriorId, setSelectedInteriorId] = useState(defaultInteriorOptions[0].id);
  const [selectedGrade, setSelectedGrade] = useState('');
  const [selectedExtras, setSelectedExtras] = useState<string[]>(['adas']);
  const [selectedAccessories, setSelectedAccessories] = useState<string[]>(['protection']);
  const [selectedAddons, setSelectedAddons] = useState<string[]>([]);
  const [downPayment, setDownPayment] = useState('250000');
  const [interestRate, setInterestRate] = useState('8.75');
  const [termMonths, setTermMonths] = useState('48');
  const [showBottomPanel, setShowBottomPanel] = useState(false);
  const [visualPulse, setVisualPulse] = useState(false);
  const [nightFxEnabled, setNightFxEnabled] = useState(false);
  const [compareVehicleIds, setCompareVehicleIds] = useState<string[]>([]);
  const [showCompareCanvas, setShowCompareCanvas] = useState(false);
  const [active360Index, setActive360Index] = useState(0);
  const [autoRotate360, setAutoRotate360] = useState(true);
  const [isDragging360, setIsDragging360] = useState(false);
  const drag360Ref = useRef({ isDragging: false, lastX: 0, accumulatedDelta: 0 });
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

  const gradeOptions = useMemo(() => {
    const configured = normalizeStringList(selectedVehicle?.config_grades);
    if (configured.length) return configured;
    if (selectedVehicle?.variant) return [selectedVehicle.variant];
    return ['Standard'];
  }, [selectedVehicle]);

  const exteriorOptions = useMemo(
    () => normalizeSingleOptions(selectedVehicle?.config_exterior_options, defaultExteriorOptions),
    [selectedVehicle],
  );

  const interiorOptions = useMemo(
    () => normalizeSingleOptions(selectedVehicle?.config_interior_options, defaultInteriorOptions),
    [selectedVehicle],
  );

  const extrasOptions = useMemo(
    () => normalizeToggleOptions(selectedVehicle?.config_extras_options, defaultExtrasOptions),
    [selectedVehicle],
  );

  const accessoryOptions = useMemo(
    () => normalizeToggleOptions(selectedVehicle?.config_accessories_options, defaultAccessoryOptions),
    [selectedVehicle],
  );

  const addonOptions = useMemo(
    () => normalizeToggleOptions(selectedVehicle?.config_addons_options, defaultAddonOptions),
    [selectedVehicle],
  );

  useEffect(() => {
    setSelectedGrade((prev) => (gradeOptions.includes(prev) ? prev : gradeOptions[0] || 'Standard'));
  }, [gradeOptions]);

  useEffect(() => {
    setSelectedExteriorId((prev) => (exteriorOptions.some((option) => option.id === prev) ? prev : exteriorOptions[0]?.id || ''));
  }, [exteriorOptions]);

  useEffect(() => {
    setSelectedInteriorId((prev) => (interiorOptions.some((option) => option.id === prev) ? prev : interiorOptions[0]?.id || ''));
  }, [interiorOptions]);

  useEffect(() => {
    const available = new Set(extrasOptions.map((option) => option.id));
    setSelectedExtras((prev) => {
      const filtered = prev.filter((id) => available.has(id));
      return filtered.length ? filtered : extrasOptions.slice(0, 1).map((option) => option.id);
    });
  }, [extrasOptions]);

  useEffect(() => {
    const available = new Set(accessoryOptions.map((option) => option.id));
    setSelectedAccessories((prev) => {
      const filtered = prev.filter((id) => available.has(id));
      return filtered.length ? filtered : accessoryOptions.slice(0, 1).map((option) => option.id);
    });
  }, [accessoryOptions]);

  useEffect(() => {
    const available = new Set(addonOptions.map((option) => option.id));
    setSelectedAddons((prev) => prev.filter((id) => available.has(id)));
  }, [addonOptions]);

  const selectedExterior = exteriorOptions.find((option) => option.id === selectedExteriorId) || exteriorOptions[0];
  const selectedWheel = wheelOptions.find((option) => option.id === selectedWheelId) || wheelOptions[0];
  const selectedInterior = interiorOptions.find((option) => option.id === selectedInteriorId) || interiorOptions[0];
  const chosenExtras = extrasOptions.filter((option) => selectedExtras.includes(option.id));
  const chosenAccessories = accessoryOptions.filter((option) => selectedAccessories.includes(option.id));
  const chosenAddons = addonOptions.filter((option) => selectedAddons.includes(option.id));
  const selectedBrandKey = (selectedVehicle?.brand || '').toLowerCase();
  const selectedBrandTheme = brandVisualTheme[selectedBrandKey] || brandVisualTheme.default;
  const selectedInteriorColor = interiorColorById[selectedInterior.id] || '#334155';
  const selectedCompareVehicles = useMemo(
    () => compareVehicleIds
      .map((id) => vehicles.find((vehicle) => vehicle.id === id) || null)
      .filter((vehicle): vehicle is ConfigVehicle => Boolean(vehicle)),
    [compareVehicleIds, vehicles],
  );
  const exploreVehicle = selectedVehicle || vehicles[0] || null;
  const exploreBrandKey = (exploreVehicle?.brand || '').toLowerCase() as keyof typeof staticBrandImageCatalog;
  const exploreImageFrames = useMemo(() => {
    const brandFrames = staticBrandImageCatalog[exploreBrandKey] ? [...staticBrandImageCatalog[exploreBrandKey]] : [];
    const configuredFrames = normalizeStringList(exploreVehicle?.config_image_urls);
    const primaryImage = exploreVehicle?.image_url ? [exploreVehicle.image_url] : [];
    return Array.from(new Set([...configuredFrames, ...primaryImage, ...brandFrames])).filter(Boolean);
  }, [exploreBrandKey, exploreVehicle?.config_image_urls, exploreVehicle?.image_url]);

  const basePrice = getVehiclePrice(selectedVehicle);
  const optionsTotal = [selectedExterior.price, selectedWheel.price, selectedInterior.price]
    .concat(chosenExtras.map((option) => option.price))
    .concat(chosenAccessories.map((option) => option.price))
    .concat(chosenAddons.map((option) => option.price))
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

  const step360Frame = (direction: 1 | -1) => {
    if (exploreImageFrames.length <= 1) return;
    setActive360Index((prev) => (prev + direction + exploreImageFrames.length) % exploreImageFrames.length);
  };

  const handle360PointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (exploreImageFrames.length <= 1) return;
    drag360Ref.current = { isDragging: true, lastX: event.clientX, accumulatedDelta: 0 };
    setIsDragging360(true);
    setAutoRotate360(false);
    if (event.currentTarget.setPointerCapture) event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handle360PointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!drag360Ref.current.isDragging || exploreImageFrames.length <= 1) return;

    const deltaX = event.clientX - drag360Ref.current.lastX;
    drag360Ref.current.lastX = event.clientX;
    drag360Ref.current.accumulatedDelta += deltaX;

    const threshold = 22;
    while (drag360Ref.current.accumulatedDelta >= threshold) {
      step360Frame(-1);
      drag360Ref.current.accumulatedDelta -= threshold;
    }
    while (drag360Ref.current.accumulatedDelta <= -threshold) {
      step360Frame(1);
      drag360Ref.current.accumulatedDelta += threshold;
    }
  };

  const stop360Drag = () => {
    drag360Ref.current.isDragging = false;
    drag360Ref.current.accumulatedDelta = 0;
    setIsDragging360(false);
  };

  useEffect(() => {
    setVisualPulse(true);
    const timer = setTimeout(() => setVisualPulse(false), 320);
    return () => clearTimeout(timer);
  }, [selectedVehicleId, selectedExteriorId, selectedInteriorId]);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    const savedPreference = window.localStorage.getItem(NIGHT_FX_STORAGE_KEY);
    if (savedPreference === 'on') {
      setNightFxEnabled(true);
      return;
    }

    if (savedPreference === 'off') {
      setNightFxEnabled(false);
      return;
    }

    setNightFxEnabled(document.documentElement.classList.contains('dark'));
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(NIGHT_FX_STORAGE_KEY, nightFxEnabled ? 'on' : 'off');
  }, [nightFxEnabled]);

  useEffect(() => {
    setActive360Index(0);
  }, [exploreVehicle?.id]);

  useEffect(() => {
    if (!showCompareCanvas || !autoRotate360 || exploreImageFrames.length <= 1) return;

    const timer = setInterval(() => {
      setActive360Index((prev) => (prev + 1) % exploreImageFrames.length);
    }, 1300);

    return () => clearInterval(timer);
  }, [showCompareCanvas, autoRotate360, exploreImageFrames]);

  const fxIntensityMultiplier = nightFxEnabled ? 1 : 0.6;

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(15,118,110,0.16),_transparent_30%),radial-gradient(circle_at_top_right,_rgba(249,115,22,0.12),_transparent_24%),linear-gradient(180deg,hsl(var(--background)),hsl(var(--muted)/0.25))]">
      <div className="mx-auto max-w-[1440px] px-2 py-4 pb-40 sm:px-2 lg:px-4 lg:py-5 lg:pb-0">
       
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
             
                <div className="relative min-h-[360px] overflow-hidden bg-gradient-to-br from-slate-100 via-white to-amber-50 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800">
                  {selectedVehicle ? (
                    <>
                      <VehicleImage
                        imageUrl={getPrimaryVehicleImage(selectedVehicle)}
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
                          opacity: (visualPulse ? 1 : 0.72) * fxIntensityMultiplier,
                        }}
                      />

                      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-32 overflow-hidden">
                        <div
                          className="absolute -left-16 bottom-0 h-20 w-72 rounded-full bg-white/22 blur-3xl"
                          style={{
                            opacity: (visualPulse ? 0.55 : 0.33) * fxIntensityMultiplier,
                            animation: 'fogFloatLeft 8.5s ease-in-out infinite',
                          }}
                        />
                        <div
                          className="absolute -right-14 bottom-1 h-20 w-64 rounded-full bg-slate-100/20 blur-3xl"
                          style={{
                            opacity: (visualPulse ? 0.5 : 0.3) * fxIntensityMultiplier,
                            animation: 'fogFloatRight 9.25s ease-in-out infinite',
                          }}
                        />
                        <div
                          className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-r from-transparent via-white/20 to-transparent blur-2xl"
                          style={{ opacity: (visualPulse ? 0.55 : 0.35) * fxIntensityMultiplier }}
                        />
                      </div>

                      <div className="pointer-events-none absolute inset-0">
                        <div
                          className="absolute left-[21%] top-[44%] h-14 w-16 rounded-full bg-amber-100/60 blur-xl"
                          style={{ opacity: (visualPulse ? 0.78 : 0.5) * fxIntensityMultiplier }}
                        />
                        <div
                          className="absolute right-[21%] top-[44%] h-14 w-16 rounded-full bg-amber-100/60 blur-xl"
                          style={{ opacity: (visualPulse ? 0.74 : 0.46) * fxIntensityMultiplier }}
                        />
                        <div
                          className="absolute left-[23%] top-[45.5%] h-20 w-[30%] rounded-r-full bg-gradient-to-r from-amber-200/28 via-amber-100/16 to-transparent blur-2xl"
                          style={{
                            opacity: (visualPulse ? 0.65 : 0.4) * fxIntensityMultiplier,
                            transform: 'skewX(-8deg)',
                            mixBlendMode: 'screen',
                          }}
                        />
                        <div
                          className="absolute right-[23%] top-[45.5%] h-20 w-[30%] rounded-l-full bg-gradient-to-l from-amber-200/28 via-amber-100/16 to-transparent blur-2xl"
                          style={{
                            opacity: (visualPulse ? 0.62 : 0.38) * fxIntensityMultiplier,
                            transform: 'skewX(8deg)',
                            mixBlendMode: 'screen',
                          }}
                        />
                      </div>

                      <style jsx>{`
                        @keyframes fogFloatLeft {
                          0%, 100% { transform: translateX(0px) translateY(0px) scale(1); }
                          50% { transform: translateX(10px) translateY(-4px) scale(1.03); }
                        }
                        @keyframes fogFloatRight {
                          0%, 100% { transform: translateX(0px) translateY(0px) scale(1); }
                          50% { transform: translateX(-12px) translateY(-3px) scale(1.02); }
                        }
                      `}</style>

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
   <div className="flex items-center justify-between gap-3 border-b border-border/70 px-5 py-4 sm:px-6">
                  
                  <div className="flex items-center gap-2">
                     <Button className="gap-2 rounded-xl" onClick={handleReserve} disabled={!selectedVehicle}>
                        Reserve Car
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" className="rounded-xl" onClick={openCompareCanvas}>
                        Explore More
                      </Button>
                    <Button
                      type="button"
                      variant={nightFxEnabled ? 'default' : 'outline'}
                      className="rounded-xl"
                      onClick={() => setNightFxEnabled((prev) => !prev)}
                    >
                      Night FX {nightFxEnabled ? 'On' : 'Off'}
                    </Button>
                    <Button
                      variant="outline"
                      className="rounded-xl"
                      onClick={openCompareCanvas}
                      disabled={!selectedVehicle}
                    >
                      Compare
                    </Button>
                  </div>
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
                            imageUrl={getPrimaryVehicleImage(vehicle)}
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
                    <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Grade</p>
                    <Select value={selectedGrade} onValueChange={setSelectedGrade}>
                      <SelectTrigger className="mt-2"><SelectValue placeholder="Select grade" /></SelectTrigger>
                      <SelectContent>
                        {gradeOptions.map((grade) => (
                          <SelectItem key={grade} value={grade}>{grade}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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

            <Card className="rounded-[2rem] border-border/70 shadow-card">
              <CardContent className="p-5 sm:p-6">
                <div className="mb-4 flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                  <h3 className="text-lg font-heading font-semibold text-foreground">Add-ons</h3>
                </div>
                <div className="space-y-3">
                  {addonOptions.map((option) => {
                    const checked = selectedAddons.includes(option.id);
                    return (
                      <label key={option.id} className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-3 transition ${checked ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/30'}`}>
                        <Checkbox checked={checked} onCheckedChange={() => toggleSelection(option.id, selectedAddons, setSelectedAddons)} className="mt-1" />
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
                      <Banknote className="h-4 w-4 text-emerald-700 dark:text-emerald-300" />
                      <h3 className="text-base font-heading font-semibold text-emerald-900 dark:text-emerald-100">Finance Calculator</h3>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="space-y-1.5 sm:col-span-1">
                        <Label htmlFor="down-payment" className="text-xs text-emerald-900/75 dark:text-emerald-200/80">Down payment (AED)</Label>
                        <Input id="down-payment" value={downPayment} onChange={(event) => setDownPayment(event.target.value)} placeholder="AED 250,000" className="h-9" />
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
                      <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-emerald-700 dark:text-emerald-300">Estimated EMI (AED)</p>
                      <p className="mt-1 text-2xl font-heading font-bold text-emerald-800 dark:text-emerald-200">{formatCurrency(estimatedMonthly || 0)}</p>
                      <p className="mt-1 text-xs text-emerald-700/80 dark:text-emerald-300/80">{termMonths} months at {interestRate}% annual rate (all amounts in AED)</p>
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
                      <div className="flex items-center justify-between gap-2"><span className="text-muted-foreground">Accessories</span><span className="font-medium text-foreground">{chosenAccessories.length || 0}</span></div>
                      <div className="flex items-center justify-between gap-2"><span className="text-muted-foreground">Add-ons</span><span className="font-medium text-foreground">{chosenAddons.length || 0}</span></div>
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

          {exploreVehicle && (
            <div className="border-b border-border/70 px-5 py-4 sm:px-6">
              <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Explore More</p>
              <h3 className="mt-1 text-xl font-heading font-bold text-foreground">{exploreVehicle.brand} {exploreVehicle.model}</h3>
              <p className="text-sm text-muted-foreground">{exploreVehicle.variant || 'Standard'} • {exploreVehicle.year || 'Latest'} • {exploreVehicle.locations?.name || 'Showroom location pending'}</p>

              <div className="mt-3 overflow-hidden rounded-2xl border border-border bg-muted/20">
                <div
                  className={`relative h-56 select-none sm:h-64 ${exploreImageFrames.length > 1 ? (isDragging360 ? 'cursor-grabbing' : 'cursor-grab') : ''}`}
                  onPointerDown={handle360PointerDown}
                  onPointerMove={handle360PointerMove}
                  onPointerUp={stop360Drag}
                  onPointerCancel={stop360Drag}
                  onPointerLeave={stop360Drag}
                >
                  <VehicleImage
                    imageUrl={exploreImageFrames[active360Index] || exploreVehicle.image_url}
                    brand={exploreVehicle.brand}
                    model={exploreVehicle.model}
                    className="h-full w-full object-cover"
                  />
                  <div className="absolute inset-x-0 top-0 flex items-center justify-between p-2">
                    <span className="rounded-full bg-black/55 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white">360 View {exploreImageFrames.length > 1 ? '• Drag' : ''}</span>
                    <button
                      type="button"
                      onClick={() => setAutoRotate360((prev) => !prev)}
                      className="rounded-full bg-black/55 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white"
                    >
                      {autoRotate360 ? 'Auto Rotate On' : 'Auto Rotate Off'}
                    </button>
                  </div>
                  <button
                    type="button"
                      onClick={() => step360Frame(-1)}
                    disabled={exploreImageFrames.length <= 1}
                    className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full border border-white/40 bg-black/45 p-1.5 text-white disabled:opacity-40"
                    aria-label="Previous angle"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                      onClick={() => step360Frame(1)}
                    disabled={exploreImageFrames.length <= 1}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full border border-white/40 bg-black/45 p-1.5 text-white disabled:opacity-40"
                    aria-label="Next angle"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>

                <div className="flex gap-2 overflow-x-auto border-t border-border/70 p-2">
                  {exploreImageFrames.map((frame, index) => (
                    <button
                      key={`360-frame-${frame}-${index}`}
                      type="button"
                      onClick={() => {
                        setActive360Index(index);
                        setAutoRotate360(false);
                      }}
                      className={`h-14 w-20 shrink-0 overflow-hidden rounded-lg border ${active360Index === index ? 'border-primary ring-1 ring-primary/40' : 'border-border'}`}
                    >
                      <VehicleImage imageUrl={frame} brand={exploreVehicle.brand} model={exploreVehicle.model} className="h-full w-full object-cover" />
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-border bg-background p-3">
                  <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">About Car</p>
                  <div className="mt-2 space-y-1.5 text-sm">
                    <p className="flex items-center justify-between gap-2"><span className="text-muted-foreground">Brand</span><span className="font-medium text-foreground">{exploreVehicle.brand || '—'}</span></p>
                    <p className="flex items-center justify-between gap-2"><span className="text-muted-foreground">Model</span><span className="font-medium text-foreground">{exploreVehicle.model || '—'}</span></p>
                    <p className="flex items-center justify-between gap-2"><span className="text-muted-foreground">Variant</span><span className="font-medium text-foreground">{exploreVehicle.variant || 'Standard'}</span></p>
                    <p className="flex items-center justify-between gap-2"><span className="text-muted-foreground">Grade</span><span className="font-medium text-foreground">{selectedGrade || 'Standard'}</span></p>
                    <p className="flex items-center justify-between gap-2"><span className="text-muted-foreground">Year</span><span className="font-medium text-foreground">{exploreVehicle.year || 'Latest'}</span></p>
                    <p className="flex items-center justify-between gap-2"><span className="text-muted-foreground">Location</span><span className="font-medium text-foreground">{exploreVehicle.locations?.name || 'Pending'}</span></p>
                  </div>
                </div>

                <div className="rounded-xl border border-border bg-background p-3">
                  <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">All Specs</p>
                  <div className="mt-2 space-y-1.5 text-sm">
                    <p className="flex items-center justify-between gap-2"><span className="text-muted-foreground">Power</span><span className="font-medium text-foreground">{exploreVehicle.horsepower ? `${exploreVehicle.horsepower} HP` : '—'}</span></p>
                    <p className="flex items-center justify-between gap-2"><span className="text-muted-foreground">Range</span><span className="font-medium text-foreground">{exploreVehicle.range_km ? `${exploreVehicle.range_km} km` : '—'}</span></p>
                    <p className="flex items-center justify-between gap-2"><span className="text-muted-foreground">Seats</span><span className="font-medium text-foreground">{exploreVehicle.seating_capacity || '—'}</span></p>
                    <p className="flex items-center justify-between gap-2"><span className="text-muted-foreground">Exterior</span><span className="font-medium text-foreground">{selectedExterior.name}</span></p>
                    <p className="flex items-center justify-between gap-2"><span className="text-muted-foreground">Wheels</span><span className="font-medium text-foreground">{selectedWheel.name}</span></p>
                    <p className="flex items-center justify-between gap-2"><span className="text-muted-foreground">Interior</span><span className="font-medium text-foreground">{selectedInterior.name}</span></p>
                    <p className="flex items-center justify-between gap-2"><span className="text-muted-foreground">Extras</span><span className="font-medium text-foreground">{chosenExtras.length || 0}</span></p>
                    <p className="flex items-center justify-between gap-2"><span className="text-muted-foreground">Accessories</span><span className="font-medium text-foreground">{chosenAccessories.length || 0}</span></p>
                    <p className="flex items-center justify-between gap-2"><span className="text-muted-foreground">Add-ons</span><span className="font-medium text-foreground">{chosenAddons.length || 0}</span></p>
                  </div>
                </div>
              </div>

              <div className="mt-3 rounded-xl border border-border bg-background p-3">
                <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Price Details (AED)</p>
                <div className="mt-2 grid gap-2 text-sm sm:grid-cols-2">
                  <p className="flex items-center justify-between gap-2"><span className="text-muted-foreground">Base price</span><span className="font-medium text-foreground">{basePrice ? formatCurrency(basePrice) : 'On request'}</span></p>
                  <p className="flex items-center justify-between gap-2"><span className="text-muted-foreground">Exterior</span><span className="font-medium text-foreground">{formatCurrency(selectedExterior.price)}</span></p>
                  <p className="flex items-center justify-between gap-2"><span className="text-muted-foreground">Wheels</span><span className="font-medium text-foreground">{formatCurrency(selectedWheel.price)}</span></p>
                  <p className="flex items-center justify-between gap-2"><span className="text-muted-foreground">Interior</span><span className="font-medium text-foreground">{formatCurrency(selectedInterior.price)}</span></p>
                  <p className="flex items-center justify-between gap-2"><span className="text-muted-foreground">Extras total</span><span className="font-medium text-foreground">{formatCurrency(chosenExtras.reduce((sum, item) => sum + item.price, 0))}</span></p>
                  <p className="flex items-center justify-between gap-2"><span className="text-muted-foreground">Accessories total</span><span className="font-medium text-foreground">{formatCurrency(chosenAccessories.reduce((sum, item) => sum + item.price, 0))}</span></p>
                  <p className="flex items-center justify-between gap-2"><span className="text-muted-foreground">Add-ons total</span><span className="font-medium text-foreground">{formatCurrency(chosenAddons.reduce((sum, item) => sum + item.price, 0))}</span></p>
                  <p className="flex items-center justify-between gap-2 sm:col-span-2"><span className="text-muted-foreground">Config total</span><span className="font-semibold text-foreground">{formatCurrency(optionsTotal)}</span></p>
                  <p className="flex items-center justify-between gap-2 sm:col-span-2"><span className="text-muted-foreground">Drive-away total</span><span className="text-base font-bold text-foreground">{formatCurrency(subtotal)}</span></p>
                </div>
              </div>
            </div>
          )}

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
                        <VehicleImage imageUrl={getPrimaryVehicleImage(vehicle)} brand={vehicle.brand} model={vehicle.model} className="h-full w-full object-cover" />
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