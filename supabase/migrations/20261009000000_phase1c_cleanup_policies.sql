-- ============================================================
-- Phase 1c: Cleanup Legacy Booking RLS Policies
-- ============================================================
-- We now use atomic RPCs (request_booking_atomic_v2) for INSERTs 
-- and server actions with supabaseAdmin for STATUS UPDATEs.
-- Thus, direct client-side UPDATE policies on the bookings table 
-- are no longer needed and pose a drift risk.

-- Drop old tourist update/cancel policies
DROP POLICY IF EXISTS "Strict_Tenant_Tourist_Update_Bookings" ON public.bookings;
DROP POLICY IF EXISTS "Strict_Tenant_Tourist_Cancel_Only_Bookings" ON public.bookings;
DROP POLICY IF EXISTS "Tourists can update own bookings" ON public.bookings;

-- Drop old owner update/mark-seen policies
DROP POLICY IF EXISTS "Strict_Tenant_Owner_Update_Bookings" ON public.bookings;
DROP POLICY IF EXISTS "Strict_Tenant_Owner_MarkSeen_Bookings" ON public.bookings;
DROP POLICY IF EXISTS "Owners can update bookings for their rooms" ON public.bookings;

-- Note: SELECT policies remain intact so tourists and owners can still READ their bookings.
