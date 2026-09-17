"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight, CalendarRange, BedDouble } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Badge } from "@/components/ui/badge";

export default function ResortCalendarPage() {
  const [currentDate, setCurrentDate] = React.useState(new Date());
  const [bookings, setBookings] = React.useState<any[]>([]);
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const monthName = currentDate.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  const firstDayIndex = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  React.useEffect(() => {
    async function loadBookings() {
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) return;

        const { data: propData } = await supabase
          .from("properties")
          .select("id")
          .eq("owner_id", user.id)
          .eq("type", "resort");

        const propIds = ((propData as any[]) || []).map((p) => p.id);
        if (propIds.length === 0) return;

        const { data: roomsData } = await supabase
          .from("rooms")
          .select("id")
          .in("property_id", propIds);

        const roomIds = ((roomsData as any[]) || []).map((r) => r.id);
        if (roomIds.length === 0) return;

        const { data: bData } = await supabase
          .from("bookings")
          .select(`
            id,
            check_in_date,
            check_out_date,
            status,
            profiles!tourist_id(full_name),
            rooms!room_id(name)
          `)
          .in("room_id", roomIds)
          .in("status", ["accepted", "pending"]);

        setBookings(bData || []);
      } catch {
        // Ignored
      }
    }
    loadBookings();
  }, [currentDate]);

  const prevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-neutral-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900 tracking-tight">
            Resort Availability Calendar
          </h1>
          <p className="text-xs sm:text-sm text-neutral-600 mt-1">
            Track confirmed guest stays, check-in arrivals, and open room dates
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={prevMonth}
            className="p-2 rounded-lg border border-neutral-200 text-neutral-600 hover:text-black hover:bg-neutral-50 transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="px-4 py-2 rounded-lg border border-neutral-200 text-xs font-semibold text-neutral-900 min-w-[140px] text-center">
            {monthName}
          </span>
          <button
            onClick={nextMonth}
            className="p-2 rounded-lg border border-neutral-200 text-neutral-600 hover:text-black hover:bg-neutral-50 transition-colors"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="rounded-2xl border border-neutral-200 bg-white overflow-hidden shadow-xs">
        {/* Days Header */}
        <div className="grid grid-cols-7 border-b border-neutral-200 bg-neutral-50">
          {days.map((day) => (
            <div
              key={day}
              className="py-2.5 text-center text-xs font-semibold text-neutral-600 uppercase tracking-wider"
            >
              {day}
            </div>
          ))}
        </div>

        {/* Date cells */}
        <div className="grid grid-cols-7 divide-x divide-y divide-neutral-100">
          {/* Empty cells before month start */}
          {Array.from({ length: firstDayIndex }).map((_, i) => (
            <div key={`empty-${i}`} className="h-24 bg-neutral-50/50 p-2" />
          ))}

          {/* Month days */}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const dayNum = i + 1;
            const dateString = `${year}-${String(month + 1).padStart(2, "0")}-${String(
              dayNum
            ).padStart(2, "0")}`;

            const dayBookings = bookings.filter((b) => {
              return (
                dateString >= b.check_in_date && dateString <= b.check_out_date
              );
            });

            return (
              <div
                key={dayNum}
                className="h-24 p-2 relative hover:bg-neutral-50 transition-colors flex flex-col justify-between"
              >
                <span className="text-xs font-semibold text-neutral-700">
                  {dayNum}
                </span>

                <div className="space-y-1 overflow-y-auto">
                  {dayBookings.slice(0, 2).map((b) => (
                    <div
                      key={b.id}
                      className={`text-[10px] px-1.5 py-0.5 rounded truncate font-medium ${
                        b.status === "accepted"
                          ? "bg-black text-white"
                          : "bg-amber-100 text-amber-800"
                      }`}
                      title={`${b.profiles?.full_name} (${b.rooms?.name})`}
                    >
                      {b.profiles?.full_name || "Guest"}
                    </div>
                  ))}
                  {dayBookings.length > 2 && (
                    <span className="text-[9px] text-neutral-500 block">
                      +{dayBookings.length - 2} more
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="p-4 border-t border-neutral-100 flex flex-wrap items-center gap-5 text-xs text-neutral-600 bg-neutral-50/50">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-black inline-block" />
            <span>Confirmed Stay</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-amber-400 inline-block" />
            <span>Pending Request</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-neutral-300 inline-block" />
            <span>Open Available Dates</span>
          </div>
        </div>
      </div>
    </div>
  );
}
