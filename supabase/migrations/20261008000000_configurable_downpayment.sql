-- ============================================================
-- Phase 1b: Host-Configurable Downpayment Feature
-- ============================================================

-- 1. System Settings: Global Minimum Downpayment %
ALTER TABLE public.system_settings
ADD COLUMN IF NOT EXISTS min_downpayment_percent INT DEFAULT 20 CHECK (min_downpayment_percent >= 1 AND min_downpayment_percent <= 100);

-- 2. Properties: Optional listing-level default
ALTER TABLE public.properties
ADD COLUMN IF NOT EXISTS downpayment_percent INT CHECK (downpayment_percent >= 1 AND downpayment_percent <= 100);

-- 3. Rooms: Optional room-level override
ALTER TABLE public.rooms
ADD COLUMN IF NOT EXISTS downpayment_percent INT CHECK (downpayment_percent >= 1 AND downpayment_percent <= 100);

-- 4. Bookings: Effective Downpayment % and Balance Amount
ALTER TABLE public.bookings
ADD COLUMN IF NOT EXISTS downpayment_percent INT CHECK (downpayment_percent >= 1 AND downpayment_percent <= 100);

-- Balance amount is always total_price minus downpayment_amount
ALTER TABLE public.bookings
ADD COLUMN IF NOT EXISTS balance_amount NUMERIC(10,2) GENERATED ALWAYS AS (COALESCE(total_price,0) - COALESCE(downpayment_amount,0)) STORED;

-- Ensure balance amount is never negative and downpayment is never more than total price
ALTER TABLE public.bookings
ADD CONSTRAINT check_balance_amount CHECK (balance_amount >= 0 AND downpayment_amount <= total_price) NOT VALID;

-- Validate the constraint for existing rows
ALTER TABLE public.bookings VALIDATE CONSTRAINT check_balance_amount;
