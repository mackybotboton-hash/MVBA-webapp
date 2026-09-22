-- Create the extra_services table
CREATE TABLE IF NOT EXISTS public.extra_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  service_type TEXT NOT NULL CHECK (service_type IN ('Boat', 'Food', 'Tour')),
  name TEXT NOT NULL,
  price NUMERIC(10,2) NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast lookup by property
CREATE INDEX IF NOT EXISTS idx_extra_services_property ON public.extra_services(property_id);
CREATE INDEX IF NOT EXISTS idx_extra_services_active ON public.extra_services(is_active);

-- Create the booking_services junction table
CREATE TABLE IF NOT EXISTS public.booking_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES public.extra_services(id) ON DELETE CASCADE,
  price_at_booking NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_booking_services_booking ON public.booking_services(booking_id);

-- Enable RLS
ALTER TABLE public.extra_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_services ENABLE ROW LEVEL SECURITY;

-- RLS for extra_services
-- Public/Tourists can SELECT active services
CREATE POLICY "Public can view active services"
ON public.extra_services FOR SELECT
USING (is_active = true);

-- Owners can perform ALL operations on their own property's services
CREATE POLICY "Owners manage their property services"
ON public.extra_services FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.properties p 
    WHERE p.id = extra_services.property_id 
    AND p.owner_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.properties p 
    WHERE p.id = extra_services.property_id 
    AND p.owner_id = auth.uid()
  )
);

-- RLS for booking_services
-- Tourists can view their own booking's services
CREATE POLICY "Tourists can view their booking services"
ON public.booking_services FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.bookings b
    WHERE b.id = booking_services.booking_id
    AND b.tourist_id = auth.uid()
  )
);

-- Tourists can INSERT into booking_services if they own the booking
CREATE POLICY "Tourists can insert booking services"
ON public.booking_services FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.bookings b
    WHERE b.id = booking_services.booking_id
    AND b.tourist_id = auth.uid()
  )
);

-- Owners can view booking_services for bookings that belong to their properties
CREATE POLICY "Owners can view booking services for their properties"
ON public.booking_services FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.bookings b
    JOIN public.rooms r ON b.room_id = r.id
    JOIN public.properties p ON r.property_id = p.id
    WHERE b.id = booking_services.booking_id
    AND p.owner_id = auth.uid()
  )
);
