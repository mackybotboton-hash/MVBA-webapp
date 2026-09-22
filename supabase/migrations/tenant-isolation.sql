-- ===================================================================================
-- MVBA PWA: Deterministic Row Level Security (RLS) & Atomic Concurrency Schema
-- ===================================================================================

-- 1. Enable btree_gist extension for exclusion constraints (to prevent double-booking)
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- 2. Add an Exclusion Constraint to the bookings table to prevent overlapping dates atomically
ALTER TABLE bookings
ADD CONSTRAINT no_overlapping_bookings
EXCLUDE USING gist (
  room_id WITH =,
  daterange(check_in_date, check_out_date, '[)') WITH &&
)
WHERE (status NOT IN ('cancelled', 'declined'));

-- 3. Drop existing permissive policies (cleanup to apply deterministic policies)
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Owners can insert own properties" ON properties;
DROP POLICY IF EXISTS "Owners can update own properties" ON properties;
DROP POLICY IF EXISTS "Owners can delete own properties" ON properties;
DROP POLICY IF EXISTS "Owners can manage own rooms" ON rooms;
DROP POLICY IF EXISTS "Tourists can view own bookings" ON bookings;
DROP POLICY IF EXISTS "Owners can view bookings for their rooms" ON bookings;
DROP POLICY IF EXISTS "Tourists can update own bookings" ON bookings;
DROP POLICY IF EXISTS "Owners can update bookings for their rooms" ON bookings;
DROP POLICY IF EXISTS "Owners can view own dues" ON association_dues;
DROP POLICY IF EXISTS "Owners can update own dues" ON association_dues;

-- 4. Re-enforce deterministic Tenant Isolation Policies
-- Profiles: Users can only mutate their OWN profile.
CREATE POLICY "Strict_Tenant_Update_Profiles"
  ON profiles FOR UPDATE USING (auth.uid() = id);

-- Properties: Owners can only manage properties they explicitly own.
CREATE POLICY "Strict_Tenant_Insert_Properties"
  ON properties FOR INSERT WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Strict_Tenant_Update_Properties"
  ON properties FOR UPDATE USING (auth.uid() = owner_id);

CREATE POLICY "Strict_Tenant_Delete_Properties"
  ON properties FOR DELETE USING (auth.uid() = owner_id);

-- Rooms: Owners can only manage rooms linked to their properties.
CREATE POLICY "Strict_Tenant_All_Rooms"
  ON rooms FOR ALL USING (
    EXISTS (
      SELECT 1 FROM properties
      WHERE properties.id = rooms.property_id
      AND properties.owner_id = auth.uid()
    )
  );

-- Bookings: 
-- Tourists only see and update their own bookings.
-- Owners only see and update bookings tied to their specific properties.
CREATE POLICY "Strict_Tenant_Tourist_Select_Bookings"
  ON bookings FOR SELECT USING (auth.uid() = tourist_id);

CREATE POLICY "Strict_Tenant_Owner_Select_Bookings"
  ON bookings FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM rooms
      JOIN properties ON properties.id = rooms.property_id
      WHERE rooms.id = bookings.room_id
      AND properties.owner_id = auth.uid()
    )
  );

CREATE POLICY "Strict_Tenant_Tourist_Update_Bookings"
  ON bookings FOR UPDATE USING (auth.uid() = tourist_id);

CREATE POLICY "Strict_Tenant_Owner_Update_Bookings"
  ON bookings FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM rooms
      JOIN properties ON properties.id = rooms.property_id
      WHERE rooms.id = bookings.room_id
      AND properties.owner_id = auth.uid()
    )
  );

-- Association Dues: Only the specific owner or superadmin can read/write their financial records.
CREATE POLICY "Strict_Tenant_Owner_Select_Dues"
  ON association_dues FOR SELECT USING (auth.uid() = owner_id);

CREATE POLICY "Strict_Tenant_Owner_Update_Dues"
  ON association_dues FOR UPDATE USING (auth.uid() = owner_id);
