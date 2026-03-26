
CREATE OR REPLACE FUNCTION public.get_user_dealer_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(
    -- Check if user is a dealer admin
    (SELECT id FROM public.dealers WHERE admin_user_id = _user_id LIMIT 1),
    -- Otherwise get dealer from user's assigned location
    (SELECT l.dealer_id FROM public.profiles p 
     JOIN public.locations l ON l.id = p.location_id 
     WHERE p.user_id = _user_id LIMIT 1)
  )
$$;
