"use client";

import * as React from "react";
import { toast } from "sonner";
import { X, CalendarRange, Loader2, Save, UserCheck, Wrench, ShieldAlert } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

interface CalendarEventModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  propertyId: string;
  rooms: { id: string; name: string }[];
  initialEventType?: "offline_booking" | "maintenance" | "personal";
}

export function CalendarEventModal({
  isOpen,
  onClose,
  onSuccess,
  propertyId,
  rooms,
  initialEventType = "offline_booking",
}: CalendarEventModalProps) {
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [modalMode, setModalMode] = React.useState<"walk_in" | "maintenance">(
    initialEventType === "offline_booking" ? "walk_in" : "maintenance"
  );

  // Walk-in form state
  const [walkInRoomId, setWalkInRoomId] = React.useState("");
  const [guestName, setGuestName] = React.useState("");
  const [guestPhone, setGuestPhone] = React.useState("");
  const [amountPaid, setAmountPaid] = React.useState("");
  const [walkInStartDate, setWalkInStartDate] = React.useState("");
  const [walkInEndDate, setWalkInEndDate] = React.useState("");
  const [walkInNotes, setWalkInNotes] = React.useState("");

  // Blocked / Maintenance form state
  const [blockRoomId, setBlockRoomId] = React.useState("all");
  const [blockTitle, setBlockTitle] = React.useState("");
  const [blockType, setBlockType] = React.useState("maintenance");
  const [blockStartDate, setBlockStartDate] = React.useState("");
  const [blockEndDate, setBlockEndDate] = React.useState("");
  const [blockNotes, setBlockNotes] = React.useState("");

  React.useEffect(() => {
    if (isOpen) {
      setModalMode(initialEventType === "offline_booking" ? "walk_in" : "maintenance");
      
      const defaultRoom = rooms.length > 0 ? rooms[0].id : "";
      setWalkInRoomId(defaultRoom);
      setGuestName("");
      setGuestPhone("");
      setAmountPaid("");
      
      // Default dates: today and tomorrow
      const today = new Date();
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const toDateStr = (d: Date) => {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, "0");
        const day = String(d.getDate()).padStart(2, "0");
        return `${y}-${m}-${day}`;
      };

      setWalkInStartDate(toDateStr(today));
      setWalkInEndDate(toDateStr(tomorrow));
      setWalkInNotes("");

      setBlockRoomId("all");
      setBlockTitle("");
      setBlockType("maintenance");
      setBlockStartDate(toDateStr(today));
      setBlockEndDate(toDateStr(tomorrow));
      setBlockNotes("");
    }
  }, [isOpen, initialEventType, rooms]);

  if (!isOpen) return null;

  const handleSubmitWalkIn = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!walkInRoomId || walkInRoomId === "all") {
      toast.error("Please select a specific room for this walk-in guest.");
      return;
    }

    if (!guestName.trim()) {
      toast.error("Please enter the guest full name.");
      return;
    }

    if (!walkInStartDate || !walkInEndDate) {
      toast.error("Please select both check-in and check-out dates.");
      return;
    }

    if (walkInStartDate >= walkInEndDate) {
      toast.error("Check-out date must be after check-in date (at least 1 night).");
      return;
    }

    setIsSubmitting(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        toast.error("You must be logged in to record bookings.");
        return;
      }

      const descriptionParts = [];
      if (guestPhone.trim()) descriptionParts.push(`Contact: ${guestPhone.trim()}`);
      if (amountPaid.trim()) descriptionParts.push(`Cash Collected: PHP ${amountPaid.trim()}`);
      if (walkInNotes.trim()) descriptionParts.push(`Notes: ${walkInNotes.trim()}`);

      const eventPayload = {
        owner_id: user.id,
        property_id: propertyId,
        room_id: walkInRoomId,
        title: `Walk-in: ${guestName.trim()}`,
        description: descriptionParts.length > 0 ? descriptionParts.join(" | ") : "Walk-in Guest",
        start_date: walkInStartDate,
        end_date: walkInEndDate,
        event_type: "offline_booking",
      };

      const { error } = await (supabase.from("calendar_events") as any).insert([eventPayload]);

      if (error) throw error;

      toast.success("Walk-in guest recorded and room calendar blocked successfully.");
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Failed to record walk-in guest.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitBlock = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!blockTitle.trim()) {
      toast.error("Please enter a title or reason for blocking.");
      return;
    }

    if (!blockStartDate || !blockEndDate) {
      toast.error("Please select both start and end dates.");
      return;
    }

    if (blockStartDate >= blockEndDate) {
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
      if (blockRoomId === "all") {
        eventsToInsert = rooms.map((r) => ({
          owner_id: user.id,
          property_id: propertyId,
          room_id: r.id,
          title: blockTitle.trim(),
          description: blockNotes.trim() || null,
          start_date: blockStartDate,
          end_date: blockEndDate,
          event_type: blockType,
        }));
      } else {
        eventsToInsert = [
          {
            owner_id: user.id,
            property_id: propertyId,
            room_id: blockRoomId,
            title: blockTitle.trim(),
            description: blockNotes.trim() || null,
            start_date: blockStartDate,
            end_date: blockEndDate,
            event_type: blockType,
          },
        ];
      }

      const { error } = await (supabase.from("calendar_events") as any).insert(eventsToInsert);

      if (error) throw error;

      toast.success("Dates blocked on calendar successfully.");
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Failed to block dates.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg rounded-2xl bg-white shadow-xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-100">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-neutral-900 text-white">
              {modalMode === "walk_in" ? (
                <UserCheck className="h-4.5 w-4.5 text-white" />
              ) : (
                <CalendarRange className="h-4.5 w-4.5 text-white" />
              )}
            </div>
            <div>
              <h2 className="text-sm font-bold text-neutral-900">
                {modalMode === "walk_in" ? "Record Walk-In Guest" : "Block Room Availability"}
              </h2>
              <p className="text-[11px] text-neutral-500 font-medium">
                {modalMode === "walk_in"
                  ? "Instantly disable booked dates on tourist calendar and record walk-in arrival"
                  : "Block dates for maintenance, repairs, or private property use"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-neutral-500 hover:bg-neutral-100 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Mode Selector Tabs */}
        <div className="px-5 pt-3 pb-1 border-b border-neutral-100 bg-neutral-50/70">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setModalMode("walk_in")}
              className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                modalMode === "walk_in"
                  ? "bg-white text-neutral-900 shadow-xs border border-neutral-200"
                  : "text-neutral-500 hover:text-neutral-900"
              }`}
            >
              <UserCheck className="h-3.5 w-3.5" />
              <span>Walk-in Guest</span>
            </button>
            <button
              type="button"
              onClick={() => setModalMode("maintenance")}
              className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                modalMode === "maintenance"
                  ? "bg-white text-neutral-900 shadow-xs border border-neutral-200"
                  : "text-neutral-500 hover:text-neutral-900"
              }`}
            >
              <Wrench className="h-3.5 w-3.5" />
              <span>Maintenance / Block</span>
            </button>
          </div>
        </div>

        {/* Walk-in Form */}
        {modalMode === "walk_in" ? (
          <form onSubmit={handleSubmitWalkIn} className="p-5 space-y-4">
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-neutral-900 uppercase tracking-wider block">
                Assigned Room *
              </label>
              <select
                required
                value={walkInRoomId}
                onChange={(e) => setWalkInRoomId(e.target.value)}
                className="w-full h-10 px-3 rounded-xl border border-neutral-300 text-sm font-medium text-neutral-900 focus:ring-2 focus:ring-neutral-900 outline-none"
              >
                {rooms.length === 0 && <option value="">No rooms available</option>}
                {rooms.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name || "Unnamed Room"}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-neutral-900 uppercase tracking-wider block">
                  Guest Full Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Juan Dela Cruz"
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-neutral-300 text-sm font-medium text-neutral-900 placeholder:text-neutral-400 focus:ring-2 focus:ring-neutral-900 outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-neutral-900 uppercase tracking-wider block">
                  Guest Contact Number
                </label>
                <input
                  type="tel"
                  placeholder="e.g. 0917 123 4567"
                  value={guestPhone}
                  onChange={(e) => setGuestPhone(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-neutral-300 text-sm font-medium text-neutral-900 placeholder:text-neutral-400 focus:ring-2 focus:ring-neutral-900 outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-neutral-900 uppercase tracking-wider block">
                  Check-in Date *
                </label>
                <input
                  type="date"
                  required
                  value={walkInStartDate}
                  onChange={(e) => setWalkInStartDate(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-neutral-300 text-sm font-medium text-neutral-900 focus:ring-2 focus:ring-neutral-900 outline-none"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-neutral-900 uppercase tracking-wider block">
                  Check-out Date *
                </label>
                <input
                  type="date"
                  required
                  value={walkInEndDate}
                  onChange={(e) => setWalkInEndDate(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-neutral-300 text-sm font-medium text-neutral-900 focus:ring-2 focus:ring-neutral-900 outline-none"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-neutral-900 uppercase tracking-wider block">
                Cash / Amount Collected (PHP)
              </label>
              <input
                type="number"
                min="0"
                step="any"
                placeholder="e.g. 1500"
                value={amountPaid}
                onChange={(e) => setAmountPaid(e.target.value)}
                className="w-full h-10 px-3 rounded-xl border border-neutral-300 text-sm font-medium text-neutral-900 placeholder:text-neutral-400 focus:ring-2 focus:ring-neutral-900 outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-neutral-900 uppercase tracking-wider block">
                Notes / Special Requests (Optional)
              </label>
              <textarea
                rows={2}
                placeholder="e.g. Paid cash in full at counter, early arrival"
                value={walkInNotes}
                onChange={(e) => setWalkInNotes(e.target.value)}
                className="w-full p-3 rounded-xl border border-neutral-300 text-sm font-medium text-neutral-900 focus:ring-2 focus:ring-neutral-900 outline-none resize-none"
              />
            </div>

            <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-3 text-[11px] text-neutral-600 space-y-1">
              <p className="font-semibold text-neutral-900 flex items-center gap-1.5">
                <ShieldAlert className="h-3.5 w-3.5 text-neutral-700" />
                Automatic Double-Booking Protection
              </p>
              <p>
                Once saved, these dates are immediately blocked on the tourist booking calendar so online tourists cannot book this room for these dates.
              </p>
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
                className="bg-neutral-900 text-white hover:bg-neutral-800 h-9 px-5 text-xs font-bold"
              >
                {isSubmitting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                ) : (
                  <Save className="h-3.5 w-3.5 mr-1.5" />
                )}
                Confirm Walk-in & Block Dates
              </Button>
            </div>
          </form>
        ) : (
          /* Maintenance / Block Form */
          <form onSubmit={handleSubmitBlock} className="p-5 space-y-4">
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-neutral-900 uppercase tracking-wider block">
                Room *
              </label>
              <select
                required
                value={blockRoomId}
                onChange={(e) => setBlockRoomId(e.target.value)}
                className="w-full h-10 px-3 rounded-xl border border-neutral-300 text-sm font-medium text-neutral-900 focus:ring-2 focus:ring-neutral-900 outline-none"
              >
                <option value="all">Entire Property (All Rooms)</option>
                {rooms.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name || "Unnamed Room"}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-neutral-900 uppercase tracking-wider block">
                Block Reason Type *
              </label>
              <select
                value={blockType}
                onChange={(e) => setBlockType(e.target.value)}
                className="w-full h-10 px-3 rounded-xl border border-neutral-300 text-sm font-medium text-neutral-900 focus:ring-2 focus:ring-neutral-900 outline-none"
              >
                <option value="maintenance">Maintenance / Renovation / Deep Cleaning</option>
                <option value="personal">Personal / Family / Private Stay</option>
                <option value="other">Other Unavailable Reason</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-neutral-900 uppercase tracking-wider block">
                Title / Label *
              </label>
              <input
                type="text"
                required
                value={blockTitle}
                onChange={(e) => setBlockTitle(e.target.value)}
                placeholder="e.g. Air Conditioning Repair or Painting"
                className="w-full h-10 px-3 rounded-xl border border-neutral-300 text-sm font-medium text-neutral-900 placeholder:text-neutral-400 focus:ring-2 focus:ring-neutral-900 outline-none"
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
                  value={blockStartDate}
                  onChange={(e) => setBlockStartDate(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-neutral-300 text-sm font-medium text-neutral-900 focus:ring-2 focus:ring-neutral-900 outline-none"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-neutral-900 uppercase tracking-wider block">
                  End Date *
                </label>
                <input
                  type="date"
                  required
                  value={blockEndDate}
                  onChange={(e) => setBlockEndDate(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-neutral-300 text-sm font-medium text-neutral-900 focus:ring-2 focus:ring-neutral-900 outline-none"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-neutral-900 uppercase tracking-wider block">
                Notes (Optional)
              </label>
              <textarea
                rows={2}
                value={blockNotes}
                onChange={(e) => setBlockNotes(e.target.value)}
                placeholder="Details about technician, completion target, etc."
                className="w-full p-3 rounded-xl border border-neutral-300 text-sm font-medium text-neutral-900 focus:ring-2 focus:ring-neutral-900 outline-none resize-none"
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
                className="bg-neutral-900 text-white hover:bg-neutral-800 h-9 px-5 text-xs font-bold"
              >
                {isSubmitting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                ) : (
                  <Save className="h-3.5 w-3.5 mr-1.5" />
                )}
                Save & Block Dates
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
