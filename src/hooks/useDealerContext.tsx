import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { APP_ROLE } from '@/constants/roles';

export const SELECTED_LOCATION_KEY = 'dealer_selected_location_id';

export interface DealerLocation {
  id: string;
  name: string;
  city: string | null;
}

interface DealerContextValue {
  dealerId: string | null;
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
  dealerLocations: [],
  allDealerLocationIds: null,
  selectedLocationId: null,
  setSelectedLocationId: () => {},
  dealerLocationIds: null,
  loading: true,
});

export function DealerContextProvider({ children }: { children: ReactNode }) {
  const { user, role } = useAuth();
  const [dealerId, setDealerId] = useState<string | null>(null);
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
      setDealerLocations([]);
      setAllDealerLocationIds(null);
      setSelectedLocationId(null);
      setLoading(false);
      return;
    }

    if (role === APP_ROLE.SUPERADMIN) {
      setDealerId(null);
      setDealerLocations([]);
      setAllDealerLocationIds(null);
      setSelectedLocationId(null);
      setLoading(false);
      return;
    }

    const fetchDealer = async () => {
      setLoading(true);

      // Try dealer admin first
      const { data: dealer } = await supabase
        .from('dealers')
        .select('id')
        .eq('admin_user_id', user.id)
        .maybeSingle();

      let resolvedDealerId: string | null = dealer?.id || null;

      // If not a dealer admin, resolve via profile → location → dealer
      if (!resolvedDealerId) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('location_id')
          .eq('user_id', user.id)
          .maybeSingle();

        if (profile?.location_id) {
          const { data: location } = await supabase
            .from('locations')
            .select('dealer_id')
            .eq('id', profile.location_id)
            .maybeSingle();

          resolvedDealerId = location?.dealer_id || null;
        }
      }

      setDealerId(resolvedDealerId);

      if (resolvedDealerId) {
        const { data: locations } = await supabase
          .from('locations')
          .select('id, name, city')
          .eq('dealer_id', resolvedDealerId)
          .eq('is_active', true)
          .order('name');

        const locs: DealerLocation[] = (locations || []).map((l) => ({
          id: l.id,
          name: l.name || l.id,
          city: (l as any).city || null,
        }));

        setDealerLocations(locs);
        const ids = locs.map((l) => l.id);
        setAllDealerLocationIds(ids);
        // Restore stored selection only if it still belongs to this dealer
        setSelectedLocationIdRaw((prev) => (prev && ids.includes(prev) ? prev : null));
      } else {
        setDealerLocations([]);
        setAllDealerLocationIds(null);
        setSelectedLocationId(null);
      }

      setLoading(false);
    };

    void fetchDealer();
  }, [user, role]);

  const dealerLocationIds = selectedLocationId ? [selectedLocationId] : allDealerLocationIds;

  return (
    <DealerCtx.Provider
      value={{
        dealerId,
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

