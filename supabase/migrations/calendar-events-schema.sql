-- Migration: Create calendar_events table
-- Description: Adds a dedicated table for property owners to manage manual calendar events (blocking dates, offline bookings, maintenance)

CREATE TABLE IF NOT EXISTS public.calendar_events (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  property_id uuid REFERENCES public.properties(id) ON DELETE CASCADE NOT NULL,
  room_id uuid REFERENCES public.rooms(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  description text,
  start_date date NOT NULL,
  end_date date NOT NULL,
  event_type text NOT NULL DEFAULT 'maintenance', -- 'maintenance', 'offline_booking', 'personal'
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- RLS Policies
ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can manage their calendar events" 
  ON public.calendar_events
  FOR ALL 
  USING (auth.uid() = owner_id);

CREATE POLICY "Anyone can view calendar events for availability" 
  ON public.calendar_events
  FOR SELECT 
  USING (true);

-- Enable real-time for calendar events
alter publication supabase_realtime add table public.calendar_events;
