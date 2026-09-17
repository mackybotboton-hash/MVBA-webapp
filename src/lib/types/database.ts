// ============================================================
// MVBA PWA — TypeScript Database Types
// These types mirror the Supabase SQL schema.

// ============================================================

export type UserRole = "admin" | "homestay" | "resort" | "tourist";
export type PropertyType = "homestay" | "resort";
export type PropertyStatus = "active" | "renovating" | "full" | "closed";
export type BookingStatus = "pending" | "accepted" | "declined" | "cancelled" | "completed";
export type ServiceType = "boat" | "food" | "tour" | "spa";
export type DuesStatus = "paid" | "unpaid" | "overdue";

// ---- Core Table Types ----

export interface Profile {
  id: string;
  role: UserRole;
  email: string;
  full_name: string;
  phone_number: string;
  avatar_url: string;
  is_approved: boolean;
  created_at: string;
  updated_at: string;
}

export interface Property {
  id: string;
  owner_id: string;
  type: PropertyType;
  name: string;
  description: string;
  address: string;
  cover_image_url: string;
  status: PropertyStatus;
  created_at: string;
  updated_at: string;
}

export interface Room {
  id: string;
  property_id: string;
  name: string;
  description: string;
  base_price: number;
  max_capacity: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface RoomImage {
  id: string;
  room_id: string;
  image_url: string;
  display_order: number;
  created_at: string;
}

export interface Booking {
  id: string;
  tourist_id: string;
  room_id: string;
  check_in_date: string;
  check_out_date: string;
  guest_count: number;
  total_price: number;
  status: BookingStatus;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface ExtraService {
  id: string;
  property_id: string;
  service_type: ServiceType;
  name: string;
  description: string;
  price: number;
  image_url: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  booking_id: string | null;
  content: string;
  is_read: boolean;
  created_at: string;
}

export interface AssociationDue {
  id: string;
  owner_id: string;
  month: string;
  amount: number;
  status: DuesStatus;
  receipt_url: string;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Announcement {
  id: string;
  admin_id: string;
  title: string;
  content: string;
  target_role: string;
  is_active: boolean;
  created_at: string;
}

// ---- Extended Types (with relations) ----

export interface PropertyWithOwner extends Property {
  owner: Profile;
}

export interface RoomWithImages extends Room {
  room_images: RoomImage[];
}

export interface RoomWithProperty extends Room {
  property: Property;
}

export interface BookingWithDetails extends Booking {
  tourist: Profile;
  room: RoomWithProperty;
}

export interface MessageWithProfiles extends Message {
  sender: Profile;
  receiver: Profile;
}

// ---- Supabase Database type helper ----

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: Omit<Profile, "created_at" | "updated_at">;
        Update: Partial<Omit<Profile, "id" | "created_at">>;
      };
      properties: {
        Row: Property;
        Insert: Omit<Property, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<Property, "id" | "created_at">>;
      };
      rooms: {
        Row: Room;
        Insert: Omit<Room, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<Room, "id" | "created_at">>;
      };
      room_images: {
        Row: RoomImage;
        Insert: Omit<RoomImage, "id" | "created_at">;
        Update: Partial<Omit<RoomImage, "id" | "created_at">>;
      };
      bookings: {
        Row: Booking;
        Insert: Omit<Booking, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<Booking, "id" | "created_at">>;
      };
      extra_services: {
        Row: ExtraService;
        Insert: Omit<ExtraService, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<ExtraService, "id" | "created_at">>;
      };
      messages: {
        Row: Message;
        Insert: Omit<Message, "id" | "created_at">;
        Update: Partial<Omit<Message, "id" | "created_at">>;
      };
      association_dues: {
        Row: AssociationDue;
        Insert: Omit<AssociationDue, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<AssociationDue, "id" | "created_at">>;
      };
      announcements: {
        Row: Announcement;
        Insert: Omit<Announcement, "id" | "created_at">;
        Update: Partial<Omit<Announcement, "id" | "created_at">>;
      };
    };
    Views: {
      [_ in never]: never
    };
    Functions: {
      [_ in never]: never
    };
    Enums: {
      [_ in never]: never
    };
  };
}
