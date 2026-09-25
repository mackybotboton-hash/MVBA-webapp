-- ============================================================
-- MVBA PWA — Complete Supabase SQL Schema
-- San Agustin Resort and Homestay Association

-- ============================================================
-- Run this in the Supabase SQL Editor to create all tables,
-- enums, indexes, RLS policies, triggers, and storage buckets.
-- ============================================================

-- ============================================================
-- 1. CUSTOM ENUM TYPES
-- ============================================================

CREATE TYPE user_role AS ENUM ('admin', 'homestay', 'resort', 'tourist');
CREATE TYPE property_type AS ENUM ('homestay', 'resort');
CREATE TYPE property_status AS ENUM ('active', 'renovating', 'full', 'closed');
CREATE TYPE booking_status AS ENUM ('pending', 'accepted', 'declined', 'cancelled', 'completed');
CREATE TYPE payment_status AS ENUM ('awaiting_deposit', 'deposit_uploaded', 'verified', 'completed', 'refunded');
CREATE TYPE service_type AS ENUM ('boat', 'food', 'tour', 'spa');
CREATE TYPE dues_status AS ENUM ('paid', 'unpaid', 'overdue');
CREATE TYPE payment_type AS ENUM ('upfront', 'cash');
CREATE TYPE review_status AS ENUM ('published', 'hidden');

-- ============================================================
-- 2. PROFILES TABLE (extends auth.users)
-- ============================================================
-- We do NOT create a separate "users" table. Instead, we create
-- a "profiles" table that references auth.users via id.
-- This is the Supabase-recommended pattern.

CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role user_role NOT NULL DEFAULT 'tourist',
  email TEXT NOT NULL,
  full_name TEXT NOT NULL DEFAULT '',
  phone_number TEXT DEFAULT '',
  avatar_url TEXT DEFAULT '',
  is_approved BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_profiles_role ON profiles(role);
CREATE INDEX idx_profiles_email ON profiles(email);
CREATE INDEX idx_profiles_is_approved ON profiles(is_approved);

-- ============================================================
-- 3. PROPERTIES TABLE
-- ============================================================

CREATE TABLE properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type property_type NOT NULL,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  address TEXT DEFAULT '',
  cover_image_url TEXT DEFAULT '',
  promo_video_url TEXT DEFAULT '',
  policies TEXT DEFAULT '',
  check_in_time TEXT DEFAULT '14:00',
  check_out_time TEXT DEFAULT '12:00',
  status property_status NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_properties_owner ON properties(owner_id);
CREATE INDEX idx_properties_type ON properties(type);
CREATE INDEX idx_properties_status ON properties(status);

-- ============================================================
-- 4. ROOMS TABLE
-- ============================================================

CREATE TABLE rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  base_price NUMERIC(10,2) NOT NULL DEFAULT 0,
  max_capacity INTEGER NOT NULL DEFAULT 2,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_rooms_property ON rooms(property_id);
CREATE INDEX idx_rooms_is_active ON rooms(is_active);
CREATE INDEX idx_rooms_base_price ON rooms(base_price);

-- ============================================================
-- 5. ROOM IMAGES TABLE (gallery)
-- ============================================================

CREATE TABLE room_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_room_images_room ON room_images(room_id);

-- ============================================================
-- 6. BOOKINGS TABLE
-- ============================================================

CREATE TABLE bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tourist_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  check_in_date DATE NOT NULL,
  check_out_date DATE NOT NULL,
  guest_count INTEGER NOT NULL DEFAULT 1,
  total_price NUMERIC(10,2) NOT NULL DEFAULT 0,
  downpayment_amount NUMERIC(10,2) DEFAULT 0,
  commission_amount NUMERIC(10,2) DEFAULT 0,
  host_payout_amount NUMERIC(10,2) DEFAULT 0,
  convenience_fee NUMERIC(10,2) DEFAULT 0,
  payment_status payment_status DEFAULT 'awaiting_deposit',
  receipt_url TEXT DEFAULT '',
  payout_status TEXT DEFAULT 'pending',
  status booking_status NOT NULL DEFAULT 'pending',
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT check_dates CHECK (check_out_date > check_in_date),
  CONSTRAINT check_guest_count CHECK (guest_count > 0)
);

CREATE INDEX idx_bookings_tourist ON bookings(tourist_id);
CREATE INDEX idx_bookings_room ON bookings(room_id);
CREATE INDEX idx_bookings_status ON bookings(status);
CREATE INDEX idx_bookings_check_in ON bookings(check_in_date);
CREATE INDEX idx_bookings_check_out ON bookings(check_out_date);

-- ============================================================
-- 7. EXTRA SERVICES TABLE (for Resorts)
-- ============================================================

CREATE TABLE extra_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  service_type service_type NOT NULL,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  price NUMERIC(10,2) NOT NULL DEFAULT 0,
  commission_rate NUMERIC(5,2) NOT NULL DEFAULT 8.0,
  payment_type payment_type NOT NULL DEFAULT 'cash',
  image_url TEXT DEFAULT '',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_extra_services_property ON extra_services(property_id);
CREATE INDEX idx_extra_services_type ON extra_services(service_type);

-- ============================================================
-- 8. MESSAGES TABLE (Realtime Chat)
-- ============================================================

CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  receiver_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_messages_sender ON messages(sender_id);
CREATE INDEX idx_messages_receiver ON messages(receiver_id);
CREATE INDEX idx_messages_booking ON messages(booking_id);
CREATE INDEX idx_messages_created ON messages(created_at DESC);
-- Composite index for chat thread lookups
CREATE INDEX idx_messages_conversation ON messages(
  LEAST(sender_id, receiver_id),
  GREATEST(sender_id, receiver_id),
  created_at DESC
);

-- ============================================================
-- 9. ASSOCIATION DUES TABLE
-- ============================================================

CREATE TABLE association_dues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  month DATE NOT NULL, -- first day of the month (e.g. 2026-07-01)
  amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  status dues_status NOT NULL DEFAULT 'unpaid',
  receipt_url TEXT DEFAULT '',
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT unique_owner_month UNIQUE (owner_id, month)
);

CREATE INDEX idx_dues_owner ON association_dues(owner_id);
CREATE INDEX idx_dues_status ON association_dues(status);
CREATE INDEX idx_dues_month ON association_dues(month);

-- ============================================================
-- 10. ANNOUNCEMENTS TABLE
-- ============================================================

CREATE TABLE announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  target_role TEXT NOT NULL DEFAULT 'all', -- 'all', 'homestay', 'resort'
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_announcements_admin ON announcements(admin_id);
CREATE INDEX idx_announcements_target ON announcements(target_role);
CREATE INDEX idx_announcements_created ON announcements(created_at DESC);

-- ============================================================
-- 10.5 NEW FEATURES TABLES (Reviews, Addons, Dispatches)
-- ============================================================

-- 10.5.a Reviews Table
CREATE TABLE reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  tourist_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT DEFAULT '',
  image_urls TEXT[] DEFAULT '{}',
  status review_status NOT NULL DEFAULT 'published',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT unique_booking_review UNIQUE (booking_id)
);
CREATE INDEX idx_reviews_property ON reviews(property_id);
CREATE INDEX idx_reviews_tourist ON reviews(tourist_id);

-- 10.5.b Booking Add-ons Table
CREATE TABLE booking_addons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES extra_services(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 1,
  price_at_booking NUMERIC(10,2) NOT NULL DEFAULT 0,
  commission_amount NUMERIC(10,2) DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_booking_addons_booking ON booking_addons(booking_id);

-- 10.5.c Boat Dispatches Table
CREATE TABLE boat_dispatches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  service_id UUID REFERENCES extra_services(id) ON DELETE SET NULL,
  booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
  vessel_name TEXT NOT NULL,
  registration_no TEXT DEFAULT '',
  captain_name TEXT NOT NULL,
  pax_count INTEGER NOT NULL DEFAULT 1,
  destination TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Scheduled', -- Scheduled, At Sea, Returned, Cancelled
  departure_time TIMESTAMPTZ,
  arrival_time TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_boat_dispatches_property ON boat_dispatches(property_id);
CREATE INDEX idx_boat_dispatches_status ON boat_dispatches(status);

-- ============================================================
-- 11. UPDATED_AT TRIGGER FUNCTION
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all tables with updated_at
CREATE TRIGGER set_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON properties
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON rooms
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON bookings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON extra_services
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON association_dues
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON reviews
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON boat_dispatches
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- 12. AUTO-CREATE PROFILE ON AUTH SIGNUP
-- ============================================================

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, full_name, role, is_approved)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'tourist'),
    -- Tourists are auto-approved; owners need admin approval
    CASE
      WHEN COALESCE(NEW.raw_user_meta_data->>'role', 'tourist') = 'tourist' THEN true
      ELSE false
    END
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- 13. ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE extra_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE association_dues ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_addons ENABLE ROW LEVEL SECURITY;
ALTER TABLE boat_dispatches ENABLE ROW LEVEL SECURITY;

-- ---- PROFILES ----
-- Everyone can read profiles (needed for chat, property views)
CREATE POLICY "Profiles are viewable by everyone"
  ON profiles FOR SELECT USING (true);

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE USING (auth.uid() = id);

-- Admins can update any profile (for approval, role changes)
CREATE POLICY "Admins can update any profile"
  ON profiles FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ---- PROPERTIES ----
-- Active properties are viewable by everyone
CREATE POLICY "Properties are viewable by everyone"
  ON properties FOR SELECT USING (true);

-- Owners can insert their own properties
CREATE POLICY "Owners can insert own properties"
  ON properties FOR INSERT WITH CHECK (auth.uid() = owner_id);

-- Owners can update their own properties
CREATE POLICY "Owners can update own properties"
  ON properties FOR UPDATE USING (auth.uid() = owner_id);

-- Owners can delete their own properties
CREATE POLICY "Owners can delete own properties"
  ON properties FOR DELETE USING (auth.uid() = owner_id);

-- Admins can manage all properties
CREATE POLICY "Admins can manage all properties"
  ON properties FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ---- ROOMS ----
-- Rooms are viewable by everyone
CREATE POLICY "Rooms are viewable by everyone"
  ON rooms FOR SELECT USING (true);

-- Property owners can manage their rooms
CREATE POLICY "Owners can manage own rooms"
  ON rooms FOR ALL USING (
    EXISTS (
      SELECT 1 FROM properties
      WHERE properties.id = rooms.property_id
      AND properties.owner_id = auth.uid()
    )
  );

-- ---- ROOM IMAGES ----
CREATE POLICY "Room images are viewable by everyone"
  ON room_images FOR SELECT USING (true);

CREATE POLICY "Owners can manage room images"
  ON room_images FOR ALL USING (
    EXISTS (
      SELECT 1 FROM rooms
      JOIN properties ON properties.id = rooms.property_id
      WHERE rooms.id = room_images.room_id
      AND properties.owner_id = auth.uid()
    )
  );

-- ---- BOOKINGS ----
-- Tourists can view their own bookings
CREATE POLICY "Tourists can view own bookings"
  ON bookings FOR SELECT USING (auth.uid() = tourist_id);

-- Property owners can view bookings for their rooms
CREATE POLICY "Owners can view bookings for their rooms"
  ON bookings FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM rooms
      JOIN properties ON properties.id = rooms.property_id
      WHERE rooms.id = bookings.room_id
      AND properties.owner_id = auth.uid()
    )
  );

-- Tourists can create bookings
CREATE POLICY "Tourists can create bookings"
  ON bookings FOR INSERT WITH CHECK (auth.uid() = tourist_id);

-- Tourists can cancel their own bookings
CREATE POLICY "Tourists can update own bookings"
  ON bookings FOR UPDATE USING (auth.uid() = tourist_id);

-- Property owners can accept/decline bookings
CREATE POLICY "Owners can update bookings for their rooms"
  ON bookings FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM rooms
      JOIN properties ON properties.id = rooms.property_id
      WHERE rooms.id = bookings.room_id
      AND properties.owner_id = auth.uid()
    )
  );

-- Admins can view all bookings
CREATE POLICY "Admins can view all bookings"
  ON bookings FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ---- EXTRA SERVICES ----
CREATE POLICY "Extra services are viewable by everyone"
  ON extra_services FOR SELECT USING (true);

CREATE POLICY "Owners can manage own extra services"
  ON extra_services FOR ALL USING (
    EXISTS (
      SELECT 1 FROM properties
      WHERE properties.id = extra_services.property_id
      AND properties.owner_id = auth.uid()
    )
  );

-- ---- MESSAGES ----
-- Users can view messages they sent or received
CREATE POLICY "Users can view own messages"
  ON messages FOR SELECT USING (
    auth.uid() = sender_id OR auth.uid() = receiver_id
  );

-- Users can send messages
CREATE POLICY "Users can send messages"
  ON messages FOR INSERT WITH CHECK (auth.uid() = sender_id);

-- Receiver can mark messages as read
CREATE POLICY "Receiver can update messages"
  ON messages FOR UPDATE USING (auth.uid() = receiver_id);

-- ---- ASSOCIATION DUES ----
-- Owners can view their own dues
CREATE POLICY "Owners can view own dues"
  ON association_dues FOR SELECT USING (auth.uid() = owner_id);

-- Owners can update their own dues (upload receipt)
CREATE POLICY "Owners can update own dues"
  ON association_dues FOR UPDATE USING (auth.uid() = owner_id);

-- Admins can manage all dues
CREATE POLICY "Admins can manage all dues"
  ON association_dues FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ---- ANNOUNCEMENTS ----
-- Everyone can view active announcements
CREATE POLICY "Everyone can view announcements"
  ON announcements FOR SELECT USING (is_active = true);

-- Admins can manage announcements
CREATE POLICY "Admins can manage announcements"
  ON announcements FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ---- REVIEWS ----
-- Everyone can view published reviews
CREATE POLICY "Everyone can view published reviews"
  ON reviews FOR SELECT USING (status = 'published');

-- Tourists can create reviews for their completed bookings
CREATE POLICY "Tourists can insert own reviews"
  ON reviews FOR INSERT WITH CHECK (
    auth.uid() = tourist_id AND
    EXISTS (SELECT 1 FROM bookings WHERE bookings.id = booking_id AND bookings.status = 'completed')
  );

-- Tourists can update their own reviews
CREATE POLICY "Tourists can update own reviews"
  ON reviews FOR UPDATE USING (auth.uid() = tourist_id);

-- Admins can manage all reviews
CREATE POLICY "Admins can manage reviews"
  ON reviews FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ---- BOOKING ADDONS ----
-- Tourists can view their own booking addons
CREATE POLICY "Tourists can view own booking addons"
  ON booking_addons FOR SELECT USING (
    EXISTS (SELECT 1 FROM bookings WHERE bookings.id = booking_id AND bookings.tourist_id = auth.uid())
  );

-- Property owners can view addons for their bookings
CREATE POLICY "Owners can view addons for their bookings"
  ON booking_addons FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM bookings 
      JOIN rooms ON rooms.id = bookings.room_id
      JOIN properties ON properties.id = rooms.property_id
      WHERE bookings.id = booking_addons.booking_id AND properties.owner_id = auth.uid()
    )
  );

-- Tourists can create addons for their bookings
CREATE POLICY "Tourists can insert own addons"
  ON booking_addons FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM bookings WHERE bookings.id = booking_id AND bookings.tourist_id = auth.uid())
  );

-- ---- BOAT DISPATCHES ----
-- Owners can manage dispatches for their properties
CREATE POLICY "Owners can manage own dispatches"
  ON boat_dispatches FOR ALL USING (
    EXISTS (SELECT 1 FROM properties WHERE properties.id = property_id AND properties.owner_id = auth.uid())
  );

-- Admins can view all dispatches
CREATE POLICY "Admins can view all dispatches"
  ON boat_dispatches FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ============================================================
-- 14. STORAGE BUCKETS
-- ============================================================
-- Run these in the Supabase Dashboard > Storage, or via SQL:

INSERT INTO storage.buckets (id, name, public) VALUES ('property-images', 'property-images', true);
INSERT INTO storage.buckets (id, name, public) VALUES ('room-galleries', 'room-galleries', true);
INSERT INTO storage.buckets (id, name, public) VALUES ('payment-receipts', 'payment-receipts', false);
INSERT INTO storage.buckets (id, name, public) VALUES ('user-avatars', 'user-avatars', true);

-- Storage RLS policies
-- Public buckets: anyone can read
CREATE POLICY "Public read for property-images"
  ON storage.objects FOR SELECT USING (bucket_id = 'property-images');

CREATE POLICY "Public read for room-galleries"
  ON storage.objects FOR SELECT USING (bucket_id = 'room-galleries');

CREATE POLICY "Public read for user-avatars"
  ON storage.objects FOR SELECT USING (bucket_id = 'user-avatars');

-- Authenticated users can upload to public buckets
CREATE POLICY "Authenticated upload to property-images"
  ON storage.objects FOR INSERT WITH CHECK (
    bucket_id = 'property-images' AND auth.role() = 'authenticated'
  );

CREATE POLICY "Authenticated upload to room-galleries"
  ON storage.objects FOR INSERT WITH CHECK (
    bucket_id = 'room-galleries' AND auth.role() = 'authenticated'
  );

CREATE POLICY "Authenticated upload to user-avatars"
  ON storage.objects FOR INSERT WITH CHECK (
    bucket_id = 'user-avatars' AND auth.role() = 'authenticated'
  );

-- Payment receipts: only the uploader and admins can view
CREATE POLICY "Owner and admin read receipts"
  ON storage.objects FOR SELECT USING (
    bucket_id = 'payment-receipts' AND (
      auth.uid()::text = (storage.foldername(name))[1]
      OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    )
  );

CREATE POLICY "Authenticated upload to payment-receipts"
  ON storage.objects FOR INSERT WITH CHECK (
    bucket_id = 'payment-receipts' AND auth.role() = 'authenticated'
  );

-- ============================================================
-- 15. ENABLE REALTIME ON MESSAGES TABLE
-- ============================================================

ALTER PUBLICATION supabase_realtime ADD TABLE messages;

-- ============================================================
-- 16. TRIGGER: AUTOMATICALLY CREATE PROFILE ON SIGNUP
-- ============================================================
-- 1. Create the function that inserts a row into public.profiles
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role, phone_number)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'tourist'::user_role),
    COALESCE(NEW.raw_user_meta_data->>'phone_number', '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 2. Bind the function to a trigger on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

