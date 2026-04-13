
-- Landlord weekly viewing schedule (uniform across all properties)
CREATE TABLE public.viewing_schedule (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  landlord_id UUID NOT NULL,
  day_of_week INT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0=Monday, 6=Sunday
  start_time TIME NOT NULL DEFAULT '10:00',
  end_time TIME NOT NULL DEFAULT '18:00',
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(landlord_id, day_of_week)
);

ALTER TABLE public.viewing_schedule ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Landlords can view own schedule" ON public.viewing_schedule FOR SELECT USING (auth.uid() = landlord_id);
CREATE POLICY "Landlords can insert own schedule" ON public.viewing_schedule FOR INSERT WITH CHECK (auth.uid() = landlord_id);
CREATE POLICY "Landlords can update own schedule" ON public.viewing_schedule FOR UPDATE USING (auth.uid() = landlord_id);
CREATE POLICY "Landlords can delete own schedule" ON public.viewing_schedule FOR DELETE USING (auth.uid() = landlord_id);

-- Viewing bookings
CREATE TABLE public.viewing_bookings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  landlord_id UUID NOT NULL,
  property_id UUID NOT NULL,
  applicant_id UUID NOT NULL,
  slot_start TIMESTAMPTZ NOT NULL,
  slot_end TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending_landlord', -- pending_landlord, confirmed, cancelled_tenant, cancelled_landlord, completed
  tenant_confirmed_3d BOOLEAN DEFAULT false,
  tenant_confirmed_1d BOOLEAN DEFAULT false,
  cancelled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(landlord_id, slot_start) -- prevent double-booking
);

ALTER TABLE public.viewing_bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Landlords can view own bookings" ON public.viewing_bookings FOR SELECT USING (auth.uid() = landlord_id);
CREATE POLICY "Landlords can update own bookings" ON public.viewing_bookings FOR UPDATE USING (auth.uid() = landlord_id);
CREATE POLICY "Landlords can insert own bookings" ON public.viewing_bookings FOR INSERT WITH CHECK (auth.uid() = landlord_id);
CREATE POLICY "Landlords can delete own bookings" ON public.viewing_bookings FOR DELETE USING (auth.uid() = landlord_id);

-- Service role needs to insert bookings from edge function
CREATE POLICY "Service can insert bookings" ON public.viewing_bookings FOR INSERT WITH CHECK (true);
CREATE POLICY "Service can update bookings" ON public.viewing_bookings FOR UPDATE USING (true);
CREATE POLICY "Service can select bookings" ON public.viewing_bookings FOR SELECT USING (true);

-- Notifications
CREATE TABLE public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  landlord_id UUID NOT NULL,
  type TEXT NOT NULL DEFAULT 'info', -- booking_request, booking_confirmed, cancellation, reminder, info
  title TEXT NOT NULL,
  message TEXT,
  related_booking_id UUID,
  related_applicant_id UUID,
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Landlords can view own notifications" ON public.notifications FOR SELECT USING (auth.uid() = landlord_id);
CREATE POLICY "Landlords can update own notifications" ON public.notifications FOR UPDATE USING (auth.uid() = landlord_id);
CREATE POLICY "Service can insert notifications" ON public.notifications FOR INSERT WITH CHECK (true);

-- Enable realtime for notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.viewing_bookings;
