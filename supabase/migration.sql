-- 1. Create new Enums
DO $$ BEGIN
    CREATE TYPE payment_type AS ENUM ('upfront', 'cash');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE review_status AS ENUM ('published', 'hidden');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Update properties table
ALTER TABLE properties ADD COLUMN IF NOT EXISTS policies TEXT DEFAULT '';
ALTER TABLE properties ADD COLUMN IF NOT EXISTS check_in_time TEXT DEFAULT '14:00';
ALTER TABLE properties ADD COLUMN IF NOT EXISTS check_out_time TEXT DEFAULT '12:00';

-- 3. Update extra_services table
ALTER TABLE extra_services ADD COLUMN IF NOT EXISTS payment_type payment_type NOT NULL DEFAULT 'cash';

-- 4. Create Reviews Table
CREATE TABLE IF NOT EXISTS reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  tourist_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT DEFAULT '',
  status review_status NOT NULL DEFAULT 'published',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT unique_booking_review UNIQUE (booking_id)
);
CREATE INDEX IF NOT EXISTS idx_reviews_property ON reviews(property_id);
CREATE INDEX IF NOT EXISTS idx_reviews_tourist ON reviews(tourist_id);

-- 5. Create Booking Add-ons Table
CREATE TABLE IF NOT EXISTS booking_addons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES extra_services(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 1,
  price_at_booking NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_booking_addons_booking ON booking_addons(booking_id);

-- 6. Create Boat Dispatches Table
CREATE TABLE IF NOT EXISTS boat_dispatches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  service_id UUID REFERENCES extra_services(id) ON DELETE SET NULL,
  booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
  vessel_name TEXT NOT NULL,
  registration_no TEXT DEFAULT '',
  captain_name TEXT NOT NULL,
  pax_count INTEGER NOT NULL DEFAULT 1,
  destination TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Scheduled',
  departure_time TIMESTAMPTZ,
  arrival_time TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_boat_dispatches_property ON boat_dispatches(property_id);
CREATE INDEX IF NOT EXISTS idx_boat_dispatches_status ON boat_dispatches(status);

-- 7. Add Triggers
DO $$ BEGIN
  CREATE TRIGGER set_updated_at BEFORE UPDATE ON reviews FOR EACH ROW EXECUTE FUNCTION update_updated_at();
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TRIGGER set_updated_at BEFORE UPDATE ON boat_dispatches FOR EACH ROW EXECUTE FUNCTION update_updated_at();
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 8. RLS Policies
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_addons ENABLE ROW LEVEL SECURITY;
ALTER TABLE boat_dispatches ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Everyone can view published reviews" ON reviews FOR SELECT USING (status = 'published');
  CREATE POLICY "Tourists can insert own reviews" ON reviews FOR INSERT WITH CHECK (auth.uid() = tourist_id AND EXISTS (SELECT 1 FROM bookings WHERE bookings.id = booking_id AND bookings.status = 'completed'));
  CREATE POLICY "Tourists can update own reviews" ON reviews FOR UPDATE USING (auth.uid() = tourist_id);
  CREATE POLICY "Admins can manage reviews" ON reviews FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

  CREATE POLICY "Tourists can view own booking addons" ON booking_addons FOR SELECT USING (EXISTS (SELECT 1 FROM bookings WHERE bookings.id = booking_id AND bookings.tourist_id = auth.uid()));
  CREATE POLICY "Owners can view addons for their bookings" ON booking_addons FOR SELECT USING (EXISTS (SELECT 1 FROM bookings JOIN rooms ON rooms.id = bookings.room_id JOIN properties ON properties.id = rooms.property_id WHERE bookings.id = booking_addons.booking_id AND properties.owner_id = auth.uid()));
  CREATE POLICY "Tourists can insert own addons" ON booking_addons FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM bookings WHERE bookings.id = booking_id AND bookings.tourist_id = auth.uid()));

  CREATE POLICY "Owners can manage own dispatches" ON boat_dispatches FOR ALL USING (EXISTS (SELECT 1 FROM properties WHERE properties.id = property_id AND properties.owner_id = auth.uid()));
  CREATE POLICY "Admins can view all dispatches" ON boat_dispatches FOR SELECT USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
EXCEPTION WHEN duplicate_object THEN null; END $$;
