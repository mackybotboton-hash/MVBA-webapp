-- Add addon_commission_percentage to system_settings
ALTER TABLE public.system_settings
ADD COLUMN IF NOT EXISTS addon_commission_percentage NUMERIC NOT NULL DEFAULT 8.0;
