-- Add audit trail columns to bookings table
ALTER TABLE public.bookings
ADD COLUMN IF NOT EXISTS verified_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;
