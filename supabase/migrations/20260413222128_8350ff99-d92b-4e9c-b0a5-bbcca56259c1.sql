
-- Drop overly permissive policies on viewing_bookings
DROP POLICY IF EXISTS "Service can insert bookings" ON public.viewing_bookings;
DROP POLICY IF EXISTS "Service can update bookings" ON public.viewing_bookings;
DROP POLICY IF EXISTS "Service can select bookings" ON public.viewing_bookings;
DROP POLICY IF EXISTS "Service can insert notifications" ON public.notifications;

-- Re-create with role check (service_role bypasses RLS anyway, so these aren't needed)
-- The service_role key used by edge functions bypasses RLS automatically.
-- Landlord-scoped policies are already in place.
