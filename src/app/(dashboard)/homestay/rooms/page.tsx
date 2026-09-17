"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { toast } from "sonner";
import {
  BedDouble,
  Plus,
  Edit2,
  Trash2,
  Users,
  Check,
  RefreshCw,
  Eye,
  Home,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RoomFormModal } from "@/components/owner/room-form-modal";
import { PropertyFormModal } from "@/components/owner/property-form-modal";
import { EmptyState } from "@/components/tourist/empty-state";

export default function HomestayRoomsPage() {
  const [property, setProperty] = React.useState<any>(null);
  const [rooms, setRooms] = React.useState<any[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  // Modals
  const [isRoomModalOpen, setIsRoomModalOpen] = React.useState(false);
  const [editingRoom, setEditingRoom] = React.useState<any>(null);
  const [isPropertyModalOpen, setIsPropertyModalOpen] = React.useState(false);

  const fetchRooms = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setIsLoading(false);
        return;
      }

      // Fetch owner's homestay
      const { data: propData } = await supabase
        .from("properties")
        .select("*")
        .eq("owner_id", user.id)
        .eq("type", "homestay")
        .limit(1);

      const ownerProp = propData && propData.length > 0 ? (propData as any[])[0] : null;
      setProperty(ownerProp);

      if (ownerProp) {
        const { data: roomsData } = await supabase
          .from("rooms")
          .select("*, room_images(id, image_url, display_order)")
          .eq("property_id", ownerProp.id)
          .order("created_at", { ascending: true });

        setRooms(roomsData || []);
      }
    } catch {
      // Ignored
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchRooms();
  }, [fetchRooms]);

  const handleToggleActive = async (roomId: string, currentStatus: boolean) => {
    try {
      const supabase = createClient();
      await (supabase.from("rooms") as any)
        .update({ is_active: !currentStatus })
        .eq("id", roomId);

      setRooms((prev) =>
        prev.map((r) => (r.id === roomId ? { ...r, is_active: !currentStatus } : r))
      );
      toast.success(
        !currentStatus ? "Room is now visible to tourists" : "Room marked inactive"
      );
    } catch {
      toast.error("Failed to update status");
    }
  };

  const handleDeleteRoom = async (roomId: string) => {
    if (!confirm("Are you sure you want to remove this room?")) return;
    try {
      const supabase = createClient();
      await supabase.from("rooms").delete().eq("id", roomId);
      setRooms((prev) => prev.filter((r) => r.id !== roomId));
      toast.success("Room removed");
    } catch {
      toast.error("Failed to delete room");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900 tracking-tight">
            Homestay Room Inventory
          </h1>
          <p className="text-xs sm:text-sm text-neutral-600 mt-1">
            Add accommodations, set per-night pricing in ₱, and control availability
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchRooms}
            title="Refresh"
            className="p-2 rounded-lg border border-neutral-200 hover:bg-neutral-100 text-neutral-600 transition-colors"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
          </button>

          {property && (
            <Button
              onClick={() => {
                setEditingRoom(null);
                setIsRoomModalOpen(true);
              }}
              className="bg-black text-white hover:bg-neutral-800 text-xs h-9 px-4 font-semibold"
            >
              <Plus className="h-4 w-4 mr-1.5" />
              Add Room
            </Button>
          )}
        </div>
      </div>

      {/* No Property Warning */}
      {!property ? (
        <EmptyState
          icon={Home}
          title="Create a homestay listing first"
          description="You need to set up your homestay profile before adding rooms."
          actionLabel="Create Homestay Profile"
          onAction={() => setIsPropertyModalOpen(true)}
        />
      ) : rooms.length === 0 ? (
        <EmptyState
          icon={BedDouble}
          title="No rooms added yet"
          description="Start receiving bookings by adding your first homestay room with rates and photo details."
          actionLabel="Add Your First Room"
          onAction={() => {
            setEditingRoom(null);
            setIsRoomModalOpen(true);
          }}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {rooms.map((room) => {
            const roomImage =
              room.room_images?.[0]?.image_url ||
              room.image_url ||
              "https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=600&q=80";

            return (
              <div
                key={room.id}
                className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-xs flex flex-col justify-between gap-4 hover:border-neutral-300 transition-all"
              >
                <div className="flex items-start gap-4">
                  {/* Room Thumbnail */}
                  <div className="relative h-20 w-24 rounded-xl overflow-hidden bg-neutral-100 shrink-0 border border-neutral-200">
                    <Image
                      src={roomImage}
                      alt={room.name}
                      fill
                      className="object-cover"
                    />
                  </div>

                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-bold text-base text-neutral-900 leading-snug truncate">
                        {room.name}
                      </h3>

                      <Badge
                        variant={room.is_active ? "success" : "subtle"}
                        size="sm"
                        dot
                      >
                        {room.is_active ? "Active" : "Hidden"}
                      </Badge>
                    </div>

                    <p className="text-xs text-neutral-600 flex items-center gap-1 font-medium">
                      <Users className="h-3 w-3 text-neutral-500" /> Max {room.max_capacity} guests
                    </p>

                    {room.description && (
                      <p className="text-xs text-neutral-600 leading-relaxed line-clamp-2">
                        {room.description}
                      </p>
                    )}
                  </div>
                </div>

              <div className="pt-3 border-t border-neutral-100 flex items-center justify-between">
                <div>
                  <span className="text-lg font-bold text-neutral-900">
                    ₱{Number(room.base_price).toLocaleString()}
                  </span>
                  <span className="text-xs text-neutral-500"> / night</span>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => handleToggleActive(room.id, room.is_active)}
                    className="text-xs px-2.5 py-1 rounded-md border border-neutral-200 text-neutral-600 hover:bg-neutral-50 transition-colors"
                  >
                    {room.is_active ? "Deactivate" : "Activate"}
                  </button>

                  <button
                    onClick={() => {
                      setEditingRoom(room);
                      setIsRoomModalOpen(true);
                    }}
                    className="p-1.5 rounded-md border border-neutral-200 text-neutral-600 hover:text-black hover:bg-neutral-50 transition-colors"
                    title="Edit room"
                  >
                    <Edit2 className="h-3.5 w-3.5" />
                  </button>

                  <button
                    onClick={() => handleDeleteRoom(room.id)}
                    className="p-1.5 rounded-md border border-neutral-200 text-neutral-500 hover:text-red-600 hover:border-red-200 hover:bg-red-50 transition-colors"
                    title="Delete room"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
        </div>
      )}

      {/* Modals */}
      {property && (
        <RoomFormModal
          isOpen={isRoomModalOpen}
          onClose={() => setIsRoomModalOpen(false)}
          onSuccess={fetchRooms}
          propertyId={property.id}
          initialData={editingRoom}
        />
      )}

      <PropertyFormModal
        isOpen={isPropertyModalOpen}
        onClose={() => setIsPropertyModalOpen(false)}
        onSuccess={fetchRooms}
        defaultType="homestay"
      />
    </div>
  );
}
