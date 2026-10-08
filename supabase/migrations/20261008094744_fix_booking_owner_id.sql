-- ==============================================================================
-- MVBA PWA: Fix Bookings owner_id Population
-- ==============================================================================
-- To ensure Supabase Realtime filtering (owner_id=eq.{userId}) works correctly,
-- we must ensure owner_id is populated immediately when a booking is inserted.
-- A trigger is the most robust way to ensure this, avoiding the need to modify
-- multiple RPCs or API routes.

CREATE OR REPLACE FUNCTION public.set_booking_owner_id()
RETURNS TRIGGER AS $$
BEGIN
  -- Auto-populate owner_id from the room's property if not provided
  IF NEW.owner_id IS NULL THEN
    SELECT p.owner_id INTO NEW.owner_id
    FROM public.rooms r
    JOIN public.properties p ON p.id = r.property_id
    WHERE r.id = NEW.room_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_set_booking_owner_id ON public.bookings;

CREATE TRIGGER trigger_set_booking_owner_id
  BEFORE INSERT ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.set_booking_owner_id();
