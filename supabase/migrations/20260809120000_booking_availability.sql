-- Availability helper for desk overlap checks (reused by app, bot, door services)
CREATE OR REPLACE FUNCTION public.is_desk_available(
  p_desk_id uuid,
  p_start_at timestamptz,
  p_end_at timestamptz
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NOT EXISTS (
    SELECT 1
    FROM public.bookings b
    WHERE b.desk_id = p_desk_id
      AND b.status <> 'cancelled'
      AND b.start_at < p_end_at
      AND b.end_at > p_start_at
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_desk_available(uuid, timestamptz, timestamptz) TO authenticated, service_role;
