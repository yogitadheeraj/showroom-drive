import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface DealerContext {
  dealerId: string | null;
  dealerLocationIds: string[] | null;
  loading: boolean;
}

export const useDealerContext = (): DealerContext => {
  const { user } = useAuth();
  const [dealerId, setDealerId] = useState<string | null>(null);
  const [dealerLocationIds, setDealerLocationIds] = useState<string[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setDealerId(null);
      setDealerLocationIds(null);
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

      // Fetch all location IDs for this dealer
      if (resolvedDealerId) {
        const { data: locations } = await supabase
          .from('locations')
          .select('id')
          .eq('dealer_id', resolvedDealerId);

        setDealerLocationIds(locations?.map(l => l.id) || []);
      } else {
        setDealerLocationIds(null);
      }

      setLoading(false);
    };

    fetchDealer();
  }, [user]);

  return { dealerId, dealerLocationIds, loading };
};
