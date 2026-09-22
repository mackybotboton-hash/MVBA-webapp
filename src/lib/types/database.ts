// ============================================================
// MVBA PWA — TypeScript Database Types
// These types mirror the Supabase SQL schema.
// ============================================================

export type UserRole = "admin" | "homestay" | "resort" | "tourist";
export type PropertyType = "homestay" | "resort";
export type PropertyStatus = "active" | "renovating" | "full" | "closed";
export type BookingStatus = "pending" | "accepted" | "declined" | "cancelled" | "completed";
export type PaymentStatus = "awaiting_deposit" | "deposit_uploaded" | "verified" | "completed" | "refunded";
export type ServiceType = "boat" | "food" | "tour" | "spa";
export type DuesStatus = "paid" | "unpaid" | "overdue";
export type NotificationType =
  | "new_booking"
  | "booking_status"
  | "new_message"
  | "deposit_verified"
  | "booking_cancelled";

// ---- Core Table Types ----

export interface Profile {
  id: string;
  role: UserRole;
  email: string;
  full_name: string;
  phone_number?: string | null;
  avatar_url?: string | null;
  onesignal_id?: string | null;
  is_approved: boolean;
  created_at: string;
  updated_at: string;
}

export interface Property {
  id: string;
  owner_id: string;
  type: PropertyType;
  name: string;
  description?: string | null;
  address?: string | null;
  cover_image_url?: string | null;
  promo_video_url?: string | null;
  policies?: string | null;
  check_in_time?: string | null;
  check_out_time?: string | null;
  status: PropertyStatus;
  facebook_url: string | null;
  messenger_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface Room {
  id: string;
  property_id: string;
  name: string;
  description?: string | null;
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
  /** Denormalized from rooms→properties.owner_id for Supabase Realtime filtering */
  owner_id: string | null;
  /** Set when the host opens the Bookings page; NULL drives the unseen badge count */
  seen_by_host_at: string | null;
  check_in_date: string;
  check_out_date: string;
  guest_count: number;
  total_price: number;
  downpayment_amount?: number | null;
  commission_amount?: number | null;
  host_payout_amount?: number | null;
  payment_status?: PaymentStatus | string | null;
  receipt_url?: string | null;
  payout_status?: string | null;
  status: BookingStatus;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  body: string;
  url: string | null;
  is_read: boolean;
  created_at: string;
}

export interface ExtraService {
  id: string;
  property_id: string;
  service_type: ServiceType;
  name: string;
  description?: string | null;
  price: number;
  payment_type?: string | null;
  image_url?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  booking_id?: string | null;
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
  receipt_url?: string | null;
  paid_at?: string | null;
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

export interface Review {
  id: string;
  booking_id: string;
  tourist_id: string;
  property_id: string;
  rating: number;
  comment?: string | null;
  status: "published" | "hidden";
  created_at: string;
  updated_at: string;
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
        Insert: Partial<Profile> & { id: string; email: string };
        Update: Partial<Profile>;
        Relationships: [];
      };
      properties: {
        Row: Property;
        Insert: Omit<Property, "id" | "created_at" | "updated_at"> & { id?: string };
        Update: Partial<Property>;
        Relationships: [];
      };
      rooms: {
        Row: Room;
        Insert: Omit<Room, "id" | "created_at" | "updated_at"> & { id?: string };
        Update: Partial<Room>;
        Relationships: [];
      };
      room_images: {
        Row: RoomImage;
        Insert: Omit<RoomImage, "id" | "created_at"> & { id?: string };
        Update: Partial<RoomImage>;
        Relationships: [];
      };
      bookings: {
        Row: Booking;
        Insert: Partial<Booking> & { tourist_id: string; room_id: string; check_in_date: string; check_out_date: string; guest_count: number; total_price: number };
        Update: Partial<Booking>;
        Relationships: [];
      };
      notifications: {
        Row: Notification;
        Insert: Omit<Notification, "id" | "created_at">;
        Update: Partial<Omit<Notification, "id" | "created_at">>;
      };
      extra_services: {
        Row: ExtraService;
        Insert: Omit<ExtraService, "id" | "created_at" | "updated_at"> & { id?: string };
        Update: Partial<ExtraService>;
        Relationships: [];
      };
      messages: {
        Row: Message;
        Insert: Omit<Message, "id" | "created_at"> & { id?: string };
        Update: Partial<Message>;
        Relationships: [];
      };
      association_dues: {
        Row: AssociationDue;
        Insert: Omit<AssociationDue, "id" | "created_at" | "updated_at"> & { id?: string };
        Update: Partial<AssociationDue>;
        Relationships: [];
      };
      announcements: {
        Row: Announcement;
        Insert: Omit<Announcement, "id" | "created_at"> & { id?: string };
        Update: Partial<Announcement>;
        Relationships: [];
      };
      reviews: {
        Row: Review;
        Insert: Omit<Review, "id" | "created_at" | "updated_at"> & { id?: string };
        Update: Partial<Review>;
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      user_role: UserRole;
      property_type: PropertyType;
      property_status: PropertyStatus;
      booking_status: BookingStatus;
      payment_status: PaymentStatus;
      service_type: ServiceType;
      dues_status: DuesStatus;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}
