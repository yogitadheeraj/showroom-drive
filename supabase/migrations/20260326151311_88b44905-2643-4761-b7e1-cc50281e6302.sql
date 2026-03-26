
CREATE OR REPLACE FUNCTION public.onboard_dealer(
  _dealer_name text,
  _slug text,
  _contact_email text,
  _contact_phone text,
  _admin_user_id uuid,
  _brands text[],
  _locations jsonb[]
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _dealer_id uuid;
  _brand text;
  _loc jsonb;
BEGIN
  -- Create dealer
  INSERT INTO public.dealers (name, slug, contact_email, contact_phone, admin_user_id)
  VALUES (_dealer_name, _slug, _contact_email, _contact_phone, _admin_user_id)
  RETURNING id INTO _dealer_id;

  -- Create brands
  FOREACH _brand IN ARRAY _brands LOOP
    IF _brand IS NOT NULL AND trim(_brand) != '' THEN
      INSERT INTO public.brands (name, dealer_id) VALUES (trim(_brand), _dealer_id);
    END IF;
  END LOOP;

  -- Create locations
  FOREACH _loc IN ARRAY _locations LOOP
    INSERT INTO public.locations (name, address, city, state, phone, email, dealer_id)
    VALUES (
      _loc->>'name',
      _loc->>'address',
      _loc->>'city',
      NULLIF(_loc->>'state', ''),
      NULLIF(_loc->>'phone', ''),
      NULLIF(_loc->>'email', ''),
      _dealer_id
    );
  END LOOP;

  RETURN _dealer_id;
END;
$$;
