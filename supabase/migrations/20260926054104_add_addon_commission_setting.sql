-- Add addon_commission_percentage to system_settings
ALTER TABLE public.system_settings
ADD COLUMN IF NOT EXISTS addon_commission_percentage NUMERIC NOT NULL DEFAULT 8.0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'check_system_settings_addon_commission_percentage'
  ) THEN
    ALTER TABLE public.system_settings
    ADD CONSTRAINT check_system_settings_addon_commission_percentage
    CHECK (addon_commission_percentage >= 0 AND addon_commission_percentage <= 100);
  END IF;
END $$;

