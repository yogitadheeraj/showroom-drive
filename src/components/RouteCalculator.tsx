import { useState, useRef, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, MapPin, Navigation, X, RotateCcw } from 'lucide-react';

export interface RouteResult {
  destination: string;
  destLat: number;
  destLng: number;
  distanceKm: number;
  durationMinutes: number;
}

interface GeocodeSuggestion {
  display_name: string;
  lat: string;
  lon: string;
}

interface RouteCalculatorProps {
  /** Showroom / origin coordinates */
  originLat: string | number | null | undefined;
  originLng: string | number | null | undefined;
  originName?: string;
  /** Called with route info whenever route is calculated, or null when cleared */
  onRoute?: (route: RouteResult | null) => void;
  /** Pre-fill destination (for edit/view scenarios) */
  defaultDestination?: string;
  defaultDistanceKm?: number;
  defaultDurationMinutes?: number;
}

/** Formats minutes → "1h 23m" or "45m" */
const formatDuration = (minutes: number) => {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
};

const OSRM_BASE = 'https://router.project-osrm.org/route/v1/driving';
const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org/search';

const RouteCalculator = ({
  originLat,
  originLng,
  originName = 'Showroom',
  onRoute,
  defaultDestination = '',
  defaultDistanceKm,
  defaultDurationMinutes,
}: RouteCalculatorProps) => {
  const [query, setQuery] = useState(defaultDestination);
  const [suggestions, setSuggestions] = useState<GeocodeSuggestion[]>([]);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [isRouting, setIsRouting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [route, setRoute] = useState<RouteResult | null>(
    defaultDestination && defaultDistanceKm && defaultDurationMinutes
      ? { destination: defaultDestination, destLat: 0, destLng: 0, distanceKm: defaultDistanceKm, durationMinutes: defaultDurationMinutes }
      : null,
  );
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const geocodeAbortRef = useRef<AbortController | null>(null);

  const hasOrigin = originLat != null && originLng != null &&
    String(originLat).trim() !== '' && String(originLng).trim() !== '';

  const searchDestinations = useCallback((value: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!value.trim() || value.length < 3) { setSuggestions([]); return; }

    debounceRef.current = setTimeout(async () => {
      if (geocodeAbortRef.current) geocodeAbortRef.current.abort();
      geocodeAbortRef.current = new AbortController();
      setIsGeocoding(true);
      setError(null);
      try {
        const url = `${NOMINATIM_BASE}?format=json&q=${encodeURIComponent(value)}&limit=5&addressdetails=0`;
        const res = await fetch(url, {
          signal: geocodeAbortRef.current.signal,
          headers: { 'Accept-Language': 'en', 'User-Agent': 'ShowroomDrive/1.0' },
        });
        const data: GeocodeSuggestion[] = await res.json();
        setSuggestions(data);
      } catch (err: any) {
        if (err.name !== 'AbortError') setError('Could not search locations. Check your connection.');
      } finally {
        setIsGeocoding(false);
      }
    }, 600);
  }, []);

  const calculateRoute = async (dest: GeocodeSuggestion) => {
    setSuggestions([]);
    setQuery(dest.display_name);
    if (!hasOrigin) {
      setError('Showroom coordinates not available for this location.');
      return;
    }
    setIsRouting(true);
    setError(null);
    try {
      const olng = parseFloat(String(originLng));
      const olat = parseFloat(String(originLat));
      const dlng = parseFloat(dest.lon);
      const dlat = parseFloat(dest.lat);
      const url = `${OSRM_BASE}/${olng},${olat};${dlng},${dlat}?overview=false`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.code !== 'Ok' || !data.routes?.length) throw new Error('No route found between these points.');

      const oneWayKm = data.routes[0].distance / 1000;
      const oneWaySec = data.routes[0].duration;
      const result: RouteResult = {
        destination: dest.display_name,
        destLat: dlat,
        destLng: dlng,
        // Round trip: out + back
        distanceKm: Math.round(oneWayKm * 2 * 10) / 10,
        durationMinutes: Math.round((oneWaySec * 2) / 60),
      };
      setRoute(result);
      onRoute?.(result);
    } catch (err: any) {
      setError(err.message || 'Route calculation failed.');
    } finally {
      setIsRouting(false);
    }
  };

  const clearRoute = () => {
    setRoute(null);
    setQuery('');
    setSuggestions([]);
    setError(null);
    onRoute?.(null);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
        <Navigation className="h-3.5 w-3.5 text-primary" />
        Test Drive Route (optional)
      </div>

      {!hasOrigin && (
        <p className="text-xs text-warning bg-warning/10 border border-warning/30 rounded-md px-3 py-2">
          Route calculation unavailable — this location has no GPS coordinates set.
        </p>
      )}

      {/* Destination input */}
      {!route && hasOrigin && (
        <div className="relative">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <MapPin className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                className="pl-8 pr-8 text-sm"
                placeholder="Search destination address…"
                value={query}
                onChange={(e) => { setQuery(e.target.value); searchDestinations(e.target.value); }}
              />
              {(isGeocoding) && (
                <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin text-muted-foreground" />
              )}
              {query && !isGeocoding && (
                <button
                  type="button"
                  onClick={() => { setQuery(''); setSuggestions([]); }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Suggestions dropdown */}
          {suggestions.length > 0 && (
            <div className="absolute z-50 mt-1 w-full rounded-md border border-border bg-card shadow-elevated">
              {suggestions.map((s, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => calculateRoute(s)}
                  className="w-full text-left px-3 py-2 text-xs hover:bg-muted/60 transition-colors border-b border-border last:border-0 flex items-start gap-2"
                >
                  <MapPin className="h-3 w-3 mt-0.5 shrink-0 text-primary" />
                  <span className="line-clamp-2">{s.display_name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Routing indicator */}
      {isRouting && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground py-1">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Calculating route…
        </div>
      )}

      {/* Error */}
      {error && (
        <p className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2">
          {error}
        </p>
      )}

      {/* Route result card */}
      {route && (
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-start gap-2 min-w-0">
              <Navigation className="h-3.5 w-3.5 mt-0.5 shrink-0 text-primary" />
              <div className="min-w-0">
                <p className="text-xs font-medium text-foreground">{originName} → Destination → {originName}</p>
                <p className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5">{route.destination}</p>
              </div>
            </div>
            <button type="button" onClick={clearRoute} className="shrink-0 text-muted-foreground hover:text-foreground">
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20 text-[11px] gap-1">
              <Navigation className="h-3 w-3" /> {route.distanceKm} km round trip
            </Badge>
            <Badge variant="secondary" className="bg-info/10 text-info border-info/20 text-[11px] gap-1">
              <Loader2 className="h-3 w-3" /> ~{formatDuration(route.durationMinutes)} est.
            </Badge>
            <span className="text-[10px] text-muted-foreground">via OpenStreetMap</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default RouteCalculator;
