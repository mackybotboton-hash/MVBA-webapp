"use client";

import * as React from "react";
import { toast } from "sonner";
import { X, CalendarRange, Loader2, Save } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

interface CalendarEventModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  propertyId: string;
  rooms: { id: string; name: string }[];
}

export function CalendarEventModal({
  isOpen,
  onClose,
  onSuccess,
  propertyId,
  rooms,
}: CalendarEventModalProps) {
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [formData, setFormData] = React.useState({
    room_id: "",
    title: "",
    description: "",
    start_date: "",
    end_date: "",
    event_type: "maintenance",
  });

  React.useEffect(() => {
    if (isOpen) {
      setFormData({
        room_id: "all",
        title: "",
        description: "",
        start_date: "",
        end_date: "",
        event_type: "maintenance",
      });
    }
  }, [isOpen, rooms]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim() || !formData.start_date || !formData.end_date || !formData.room_id) {
      toast.error("Please fill in all required fields.");
      return;
    }

    if (formData.start_date > formData.end_date) {
      toast.error("End date must be after the start date.");
      return;
    }

    setIsSubmitting(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast.error("You must be logged in.");
        return;
      }

      let eventsToInsert = [];
      if (formData.room_id === "all") {
        eventsToInsert = rooms.map((r) => ({
          owner_id: user.id,
          property_id: propertyId,
          room_id: r.id,
          title: formData.title.trim(),
          description: formData.description.trim() || null,
          start_date: formData.start_date,
          end_date: formData.end_date,
          event_type: formData.event_type,
        }));
      } else {
        eventsToInsert = [{
          owner_id: user.id,
          property_id: propertyId,
          room_id: formData.room_id,
          title: formData.title.trim(),
          description: formData.description.trim() || null,
          start_date: formData.start_date,
          end_date: formData.end_date,
          event_type: formData.event_type,
        }];
      }

      const { error } = await (supabase.from("calendar_events") as any).insert(eventsToInsert);

      if (error) throw error;

      toast.success("Calendar event added successfully!");
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Failed to add event.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-2xl bg-white shadow-xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-100">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-black text-white">
              <CalendarRange className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-neutral-900">Add Calendar Event</h2>
              <p className="text-[10px] text-neutral-500 font-medium">Block dates for maintenance or offline bookings</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-full text-neutral-500 hover:bg-neutral-100 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-neutral-900 uppercase tracking-wider block">
              Room *
            </label>
            <select
              required
              value={formData.room_id}
              onChange={(e) => setFormData({ ...formData, room_id: e.target.value })}
              className="w-full h-10 px-3 rounded-xl border border-neutral-300 text-sm font-medium text-neutral-900 focus:ring-2 focus:ring-black outline-none"
            >
              <option value="all">Entire Property (All Rooms)</option>
              {rooms.map((r) => (
                <option key={r.id} value={r.id}>{r.name || 'Unnamed Room'}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-neutral-900 uppercase tracking-wider block">
              Event Type *
            </label>
            <select
              value={formData.event_type}
              onChange={(e) => setFormData({ ...formData, event_type: e.target.value })}
              className="w-full h-10 px-3 rounded-xl border border-neutral-300 text-sm font-medium text-neutral-900 focus:ring-2 focus:ring-black outline-none"
            >
              <option value="maintenance">Maintenance / Blocked</option>
              <option value="offline_booking">Offline Booking (Walk-in)</option>
              <option value="personal">Personal Use</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-neutral-900 uppercase tracking-wider block">
              Event Title / Guest Name *
            </label>
            <input
              type="text"
              required
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="e.g. AC Repair or John Doe Walk-in"
              className="w-full h-10 px-3 rounded-xl border border-neutral-300 text-sm font-medium text-neutral-900 placeholder:text-neutral-400 focus:ring-2 focus:ring-black outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-neutral-900 uppercase tracking-wider block">
                Start Date *
              </label>
              <input
                type="date"
                required
                value={formData.start_date}
                onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                className="w-full h-10 px-3 rounded-xl border border-neutral-300 text-sm font-medium text-neutral-900 focus:ring-2 focus:ring-black outline-none"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-neutral-900 uppercase tracking-wider block">
                End Date *
              </label>
              <input
                type="date"
                required
                value={formData.end_date}
                onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                className="w-full h-10 px-3 rounded-xl border border-neutral-300 text-sm font-medium text-neutral-900 focus:ring-2 focus:ring-black outline-none"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-neutral-900 uppercase tracking-wider block">
              Notes (Optional)
            </label>
            <textarea
              rows={2}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full p-3 rounded-xl border border-neutral-300 text-sm font-medium text-neutral-900 focus:ring-2 focus:ring-black outline-none resize-none"
            />
          </div>

          <div className="pt-2 flex gap-2 justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="h-9 px-4 text-xs font-semibold"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="bg-black text-white hover:bg-neutral-800 h-9 px-5 text-xs font-bold"
            >
              {isSubmitting ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Save className="h-3.5 w-3.5 mr-1.5" />}
              Save Event
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
