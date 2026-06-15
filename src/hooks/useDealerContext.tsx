import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { APP_ROLE } from '@/constants/roles';
import { apiGet } from '@/lib/apiClient';

export const SELECTED_LOCATION_KEY = 'dealer_selected_location_id';

export interface DealerLocation {
  id: string;
  name: string;
  city: string | null;
}

interface DealerContextValue {
  dealerId: string | null;
  dealerName: string | null;
  dealerLogoUrl: string | null;
  /** All active locations for this dealer — used for the filter dropdown. */
  dealerLocations: DealerLocation[];
  /** All location IDs regardless of current filter. */
  allDealerLocationIds: string[] | null;
  /** Currently selected location filter (null = all locations). */
  selectedLocationId: string | null;
  setSelectedLocationId: (id: string | null) => void;
  /**
   * Effective location IDs for data queries:
   * [selectedLocationId] when a location is chosen, otherwise allDealerLocationIds.
   */
  dealerLocationIds: string[] | null;
  loading: boolean;
}

const DealerCtx = createContext<DealerContextValue>({
  dealerId: null,
  dealerName: null,
  dealerLogoUrl: null,
  dealerLocations: [],
  allDealerLocationIds: null,
  selectedLocationId: null,
  setSelectedLocationId: () => {},
  dealerLocationIds: null,
  loading: true,
});

export function DealerContextProvider({ children }: { children: ReactNode }) {
  const { user, role, profile } = useAuth();
  const [dealerId, setDealerId] = useState<string | null>(null);
  const [dealerName, setDealerName] = useState<string | null>(null);
  const [dealerLogoUrl, setDealerLogoUrl] = useState<string | null>(null);
  const [dealerLocations, setDealerLocations] = useState<DealerLocation[]>([]);
  const [allDealerLocationIds, setAllDealerLocationIds] = useState<string[] | null>(null);
  const [selectedLocationId, setSelectedLocationIdRaw] = useState<string | null>(() => {
    try { return localStorage.getItem(SELECTED_LOCATION_KEY); } catch { return null; }
  });
  const [loading, setLoading] = useState(true);

  const setSelectedLocationId = (id: string | null) => {
    try {
      if (id) localStorage.setItem(SELECTED_LOCATION_KEY, id);
      else localStorage.removeItem(SELECTED_LOCATION_KEY);
    } catch { /* storage unavailable */ }
    setSelectedLocationIdRaw(id);
  };

  useEffect(() => {
    if (!user) {
      setDealerId(null);
      setDealerName(null);
      setDealerLogoUrl(null);
      setDealerLocations([]);
      setAllDealerLocationIds(null);
      setSelectedLocationId(null);
      setLoading(false);
      return;
    }

    if (role === APP_ROLE.SUPERADMIN) {
      setDealerId(null);
      setDealerName(null);
      setDealerLogoUrl(null);
      setDealerLocations([]);
      setAllDealerLocationIds(null);
      setSelectedLocationId(null);
      setLoading(false);
      return;
    }

    // Wait until profile is loaded by useAuth
    if (role === undefined || profile === undefined) return;

    const fetchDealer = async () => {
      setLoading(true);
      try {
        // Resolve dealer_id: profile.location_id → location.dealer_id
        const locationId = profile?.location_id;
        if (!locationId) {
          setDealerId(null);
          setDealerName(null);
          setDealerLogoUrl(null);
          setDealerLocations([]);
          setAllDealerLocationIds(null);
          setLoading(false);
          return;
        }

        const location = await apiGet<any>(`/api/locations/${locationId}`);
        const resolvedDealerId: string | null = location?.dealer_id || null;

        setDealerId(resolvedDealerId);

        if (resolvedDealerId) {
          const [dealer, allLocations] = await Promise.all([
            apiGet<any>(`/api/dealers/${resolvedDealerId}`),
            apiGet<any[]>(`/api/locations?dealer_id=${resolvedDealerId}&is_active=true`),
          ]);

          setDealerName(dealer?.name || null);
          setDealerLogoUrl(dealer?.logo_url || null);

          const locs: DealerLocation[] = (allLocations || []).map((l: any) => ({
            id: l.id,
            name: l.name || l.id,
            city: l.city || null,
          }));

          setDealerLocations(locs);
          const ids = locs.map((l) => l.id);
          setAllDealerLocationIds(ids);
          setSelectedLocationIdRaw((prev) => (prev && ids.includes(prev) ? prev : null));
        } else {
          setDealerName(null);
          setDealerLogoUrl(null);
          setDealerLocations([]);
          setAllDealerLocationIds(null);
          setSelectedLocationId(null);
        }
      } catch {
        // Silently fail — context degrades gracefully
        setDealerId(null);
        setDealerName(null);
        setDealerLogoUrl(null);
        setDealerLocations([]);
        setAllDealerLocationIds(null);
      } finally {
        setLoading(false);
      }
    };

    void fetchDealer();
  }, [user, role, profile]);

  const dealerLocationIds = selectedLocationId ? [selectedLocationId] : allDealerLocationIds;

  return (
    <DealerCtx.Provider
      value={{
        dealerId,
        dealerName,
        dealerLogoUrl,
        dealerLocations,
        allDealerLocationIds,
        selectedLocationId,
        setSelectedLocationId,
        dealerLocationIds,
        loading,
      }}
    >
      {children}
    </DealerCtx.Provider>
  );
}

export const useDealerContext = (): DealerContextValue => useContext(DealerCtx);

