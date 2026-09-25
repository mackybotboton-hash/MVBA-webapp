-- Add monetization fields
ALTER TABLE public.system_settings ADD COLUMN IF NOT EXISTS convenience_fee NUMERIC NOT NULL DEFAULT 100.0;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS convenience_fee NUMERIC(10,2) DEFAULT 0;
ALTER TABLE public.extra_services ADD COLUMN IF NOT EXISTS commission_rate NUMERIC(5,2) NOT NULL DEFAULT 8.0;
ALTER TABLE public.booking_addons ADD COLUMN IF NOT EXISTS commission_amount NUMERIC(10,2) DEFAULT 0;
