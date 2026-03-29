-- Helper RPC functions for daily report statistics

-- Get sales person daily statistics
CREATE OR REPLACE FUNCTION public.get_sales_person_daily_stats(
  location_id uuid,
  report_date date
)
RETURNS TABLE (
  id uuid,
  name text,
  assigned bigint,
  completed bigint,
  no_show bigint
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.full_name,
    COUNT(CASE WHEN td.status IN ('scheduled', 'confirmed', 'show', 'in_progress', 'no_show', 'completed', 'cancelled', 'rescheduled') THEN 1 END) as assigned,
    COUNT(CASE WHEN td.status = 'completed' THEN 1 END) as completed,
    COUNT(CASE WHEN td.status = 'no_show' THEN 1 END) as no_show
  FROM
    profiles p
    LEFT JOIN test_drives td ON p.id = td.assigned_sales_person_id
      AND td.location_id = $1
      AND td.scheduled_date = $2
  WHERE
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = p.user_id AND ur.role = 'sales'
    )
    AND p.location_id = $1
    AND p.is_active = true
  GROUP BY p.id, p.full_name
  ORDER BY p.full_name;
END;
$$ LANGUAGE plpgsql;

-- Get security daily statistics
CREATE OR REPLACE FUNCTION public.get_security_daily_stats(
  location_id uuid,
  report_date date
)
RETURNS TABLE (
  id uuid,
  name text,
  checked_in bigint,
  checked_out bigint
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.full_name,
    COUNT(CASE WHEN td.security_checked_in_at IS NOT NULL 
      AND DATE(td.security_checked_in_at) = $2 THEN 1 END) as checked_in,
    COUNT(CASE WHEN td.security_checked_out_at IS NOT NULL 
      AND DATE(td.security_checked_out_at) = $2 THEN 1 END) as checked_out
  FROM
    profiles p
    LEFT JOIN test_drives td ON td.location_id = $1 AND td.scheduled_date = $2
  WHERE
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = p.user_id AND ur.role = 'security'
    )
    AND p.location_id = $1
    AND p.is_active = true
  GROUP BY p.id, p.full_name
  ORDER BY p.full_name;
END;
$$ LANGUAGE plpgsql;

-- Get GRO daily statistics
CREATE OR REPLACE FUNCTION public.get_gro_daily_stats(
  location_id uuid,
  report_date date
)
RETURNS TABLE (
  id uuid,
  name text,
  assigned bigint,
  completed bigint
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.full_name,
    COUNT(CASE WHEN td.status IN ('scheduled', 'confirmed', 'show', 'in_progress', 'no_show', 'completed', 'cancelled', 'rescheduled') THEN 1 END) as assigned,
    COUNT(CASE WHEN td.status = 'completed' THEN 1 END) as completed
  FROM
    profiles p
    LEFT JOIN test_drives td ON p.id = td.assigned_gro_id
      AND td.location_id = $1
      AND td.scheduled_date = $2
  WHERE
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = p.user_id AND ur.role = 'gro'
    )
    AND p.location_id = $1
    AND p.is_active = true
  GROUP BY p.id, p.full_name
  ORDER BY p.full_name;
END;
$$ LANGUAGE plpgsql;

-- Get daily activity summary
CREATE OR REPLACE FUNCTION public.get_activity_daily_summary(
  location_id uuid,
  report_date date
)
RETURNS TABLE (
  totalEvents bigint,
  eventTypes jsonb,
  roleActivity jsonb
) AS $$
DECLARE
  v_total_events bigint;
  v_event_types jsonb;
  v_role_activity jsonb;
BEGIN
  -- Count total events for the day
  SELECT COUNT(*)
  INTO v_total_events
  FROM staff_activity_events
  WHERE location_id = $1 AND DATE(happened_at) = $2;

  -- Get event type breakdown
  SELECT jsonb_object_agg(event_type::text, count::bigint)
  INTO v_event_types
  FROM (
    SELECT event_type, COUNT(*) as count
    FROM staff_activity_events
    WHERE location_id = $1 AND DATE(happened_at) = $2
    GROUP BY event_type
  ) et;

  -- Get role-wise activity
  SELECT jsonb_object_agg(role::text, jsonb_build_object(
    'events', events_count,
    'sessions', session_count
  ))
  INTO v_role_activity
  FROM (
    SELECT
      role,
      COUNT(DISTINCT sae.id) as events_count,
      COUNT(DISTINCT sas.id) as session_count
    FROM staff_activity_events sae
    LEFT JOIN staff_activity_sessions sas ON sae.session_id = sas.id
    WHERE sae.location_id = $1 AND DATE(sae.happened_at) = $2
    GROUP BY role
  ) ra;

  RETURN QUERY SELECT v_total_events, v_event_types, v_role_activity;
END;
$$ LANGUAGE plpgsql;
