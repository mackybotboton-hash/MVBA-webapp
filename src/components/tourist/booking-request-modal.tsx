"use client";

import { useState, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { differenceInDays } from "date-fns";
import { User, CalendarIcon, CheckCircle2, Palmtree, Sailboat, Utensils, AlertTriangle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { resolveDownpaymentPercent, calculatePaymentBreakdown } from "@/lib/pricing/downpayment";
import { cn } from "@/lib/utils";

interface Room {
  id: string;
  name: string;
  base_price: number;
  max_capacity: number;
}

import { getPolicySummary, formatPolicyName } from "@/lib/pricing/cancellation-helper";
import Link from "next/link";

interface ExtraService {
  id: string;
  name: string;
  price: number;
  service_type: string;
}

interface BookingRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  propertyId: string;
  rooms: Room[];
  onSubmit: (payload: {
    roomId: string;
    checkInDate: string;
    checkOutDate: string;
    guestCount: number;
    serviceIds: string[];
    expectedDownpayment: number;
    policyAccepted: boolean;
    notes?: string;
  }) => void;
  isSubmitting?: boolean;
  errorMessage?: string | null;
}

export function BookingRequestModal({ isOpen, onClose, propertyId, rooms, onSubmit, isSubmitting = false, errorMessage = null }: BookingRequestModalProps) {
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<{ from: Date | undefined; to?: Date }>(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dayAfter = new Date();
    dayAfter.setDate(dayAfter.getDate() + 2);
    return { from: tomorrow, to: dayAfter };
  });
  const [guestCount, setGuestCount] = useState<number>(1);
  const [arrivalTime, setArrivalTime] = useState<string>("");
  const [selectedAddonIds, setSelectedAddonIds] = useState<Set<string>>(new Set());
  const [policyAccepted, setPolicyAccepted] = useState<boolean>(false);
  const [highlightPolicy, setHighlightPolicy] = useState<boolean>(false);
  const policyBoxRef = useRef<HTMLDivElement>(null);

  // Fetch property cancellation policy
  const { data: propertyPolicy } = useQuery({
    queryKey: ['property-policy', propertyId],
    queryFn: async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("properties")
        .select("cancellation_policy")
        .eq("id", propertyId)
        .single();
      return ((data as any)?.cancellation_policy || "standard") as string;
    },
    enabled: !!propertyId && isOpen,
    staleTime: 5 * 60 * 1000,
  });

  // Fetch active extra services for the property
  const { data: addons = [] } = useQuery({
    queryKey: ['extra-services', propertyId],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("extra_services")
        .select("id, name, price, service_type")
        .eq("property_id", propertyId)
        .eq("is_active", true);
      
      if (error) throw error;
      return data as ExtraService[];
    },
    enabled: !!propertyId && isOpen
  });

  // Fetch system settings for dynamic downpayment percent and convenience fee
  const { data: systemSettings } = useQuery({
    queryKey: ['system-settings-modal'],
    queryFn: async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("system_settings")
        .select("convenience_fee, default_downpayment_percent, min_downpayment_percent, commission_percentage, addon_commission_percentage, refund_full_days, refund_partial_days, refund_partial_percent")
        .limit(1)
        .single();
      return data as any;
    },
    enabled: isOpen,
    staleTime: 5 * 60 * 1000, // 5 min cache
  });

  const selectedRoom = useMemo(() => rooms.find(r => r.id === selectedRoomId), [rooms, selectedRoomId]);

  const nights = useMemo(() => {
    if (dateRange.from && dateRange.to) {
      return Math.max(1, differenceInDays(dateRange.to, dateRange.from));
    }
    return 0;
  }, [dateRange]);

  const pricing = useMemo(() => {
    if (!selectedRoom || nights === 0) return null;
    
    const roomTotal = selectedRoom.base_price * nights;
    
    // Calculate sum of selected addons (flat fee)
    const addonsTotal = addons
      .filter(addon => selectedAddonIds.has(addon.id))
      .reduce((sum, addon) => sum + Number(addon.price), 0);

    const baseTotal = roomTotal + addonsTotal;

    // Use dynamic settings; the modal receives simplified Room objects without
    // downpayment_percent, so room/property params are null — falls through to platformDefault.
    const convenienceFee = systemSettings?.convenience_fee ? Number(systemSettings.convenience_fee) : 100;
    const resolvedPercent = resolveDownpaymentPercent(
      null,
      null,
      systemSettings?.default_downpayment_percent ?? null,
      systemSettings?.min_downpayment_percent ?? null,
      systemSettings?.commission_percentage ?? null,
      systemSettings?.addon_commission_percentage ?? null
    );
    const breakdown = calculatePaymentBreakdown(baseTotal, resolvedPercent, convenienceFee);
    
    return {
      roomTotal,
      addonsTotal,
      convenienceFee,
      total: breakdown.expectedDownpayment + breakdown.expectedBalance,
      downpayment: breakdown.expectedDownpayment,
      balance: breakdown.expectedBalance,
      resolvedPercent,
    };
  }, [selectedRoom, nights, selectedAddonIds, addons, systemSettings]);

  // Adjust guest count if room changes
  if (selectedRoom && guestCount > selectedRoom.max_capacity) {
    setGuestCount(selectedRoom.max_capacity);
  }

  const isFormValid = selectedRoomId && dateRange.from && dateRange.to && guestCount > 0 && policyAccepted;

  const handleSubmit = () => {
    if (!isFormValid || !dateRange.from || !dateRange.to || !selectedRoomId) return;
    
    const formatLocalDate = (date: Date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    };

    onSubmit({
      roomId: selectedRoomId,
      checkInDate: formatLocalDate(dateRange.from),
      checkOutDate: formatLocalDate(dateRange.to),
      guestCount,
      serviceIds: Array.from(selectedAddonIds),
      expectedDownpayment: pricing?.downpayment ?? 0,
      policyAccepted,
      notes: arrivalTime ? `Estimated Arrival: ${arrivalTime}` : undefined,
    });
  };

  const handleReserveClick = () => {
    if (isSubmitting) return;
    if (!selectedRoomId || !dateRange.from || !dateRange.to) return;
    if (!policyAccepted) {
      setHighlightPolicy(true);
      policyBoxRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      setTimeout(() => setHighlightPolicy(false), 2000);
      return;
    }
    handleSubmit();
  };

  const toggleAddon = (id: string) => {
    setSelectedAddonIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const getAddonIcon = (type: string) => {
    switch(type) {
      case 'Boat': return <Sailboat className="w-4 h-4 text-blue-500" />;
      case 'Food': return <Utensils className="w-4 h-4 text-orange-500" />;
      case 'Tour': return <Palmtree className="w-4 h-4 text-emerald-500" />;
      default: return null;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden bg-white/95 backdrop-blur-xl border-zinc-200 flex flex-col max-h-[90dvh] rounded-2xl">
        <DialogHeader className="p-4 sm:p-5 pb-3 shrink-0 border-b border-zinc-100">
          <DialogTitle className="text-xl font-medium tracking-tight">Request to Book</DialogTitle>
          <DialogDescription className="text-zinc-500 text-sm">
            Select a room tier and your travel dates.
          </DialogDescription>
        </DialogHeader>

        {/* Content - Scrollable Body (The ONLY scroll area) */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 space-y-4 text-sm">
          {/* Room Selection */}
          <div className="flex flex-col gap-2.5">
            <h3 className="text-sm font-semibold text-zinc-900">Select Room Tier</h3>
            <div className="grid gap-2.5">
              <AnimatePresence>
                {rooms.map((room, idx) => {
                  const isSelected = selectedRoomId === room.id;
                  return (
                    <motion.div
                      key={room.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.05, duration: 0.2 }}
                    >
                      <button
                        onClick={() => setSelectedRoomId(room.id)}
                        className={`w-full flex items-center justify-between p-3.5 rounded-xl border text-left transition-all ${
                          isSelected 
                            ? "border-black bg-zinc-50 shadow-xs ring-1 ring-black/5" 
                            : "border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50/50"
                        }`}
                      >
                        <div>
                          <p className="font-semibold text-sm text-zinc-900">{room.name}</p>
                          <p className="text-xs text-zinc-500 flex items-center gap-1 mt-0.5">
                            <User className="w-3.5 h-3.5" /> Max {room.max_capacity} guests
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-sm text-zinc-900">₱{room.base_price.toLocaleString()}</p>
                          <p className="text-[11px] text-zinc-500">per night</p>
                        </div>
                      </button>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          </div>

          {/* Date Selection */}
          {selectedRoomId && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }} 
              animate={{ opacity: 1, height: "auto" }}
              className="flex flex-col gap-2 overflow-hidden pt-1"
            >
              <h3 className="text-sm font-semibold text-zinc-900">Travel Dates</h3>
              <div className="border border-zinc-200 rounded-xl p-1 bg-white flex justify-center overflow-hidden">
                <Calendar
                  mode="range"
                  selected={dateRange}
                  onSelect={(range) => setDateRange(range as any)}
                  numberOfMonths={1}
                  disabled={(date) => {
                    const earliestAllowed = new Date();
                    earliestAllowed.setDate(earliestAllowed.getDate() + 1);
                    earliestAllowed.setHours(0, 0, 0, 0);
                    return date < earliestAllowed;
                  }}
                  className="w-full flex justify-center"
                />
              </div>
              <div className="flex items-center justify-between text-[11px] text-zinc-500 px-1 pt-1 font-medium">
                <span>Minimum 1-day advance booking</span>
                <span>Check-in: 2:00 PM</span>
              </div>
            </motion.div>
          )}

          {/* Guest Counter */}
          {selectedRoomId && (
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }}
              className="flex items-center justify-between py-2 border-t border-zinc-100"
            >
              <div>
                <p className="text-sm font-semibold text-zinc-900">Guests</p>
                <p className="text-xs text-zinc-500">This room allows up to {selectedRoom?.max_capacity}</p>
              </div>
              <div className="flex items-center gap-4 bg-zinc-50 p-1 rounded-full border border-zinc-200">
                <button 
                  onClick={() => setGuestCount(prev => Math.max(1, prev - 1))}
                  disabled={guestCount <= 1}
                  className="w-8 h-8 rounded-full flex items-center justify-center bg-white border border-zinc-200 shadow-xs text-zinc-900 disabled:opacity-50"
                >
                  -
                </button>
                <span className="w-4 text-center font-semibold text-sm">{guestCount}</span>
                <button 
                  onClick={() => setGuestCount(prev => Math.min(selectedRoom?.max_capacity || 1, prev + 1))}
                  disabled={guestCount >= (selectedRoom?.max_capacity || 1)}
                  className="w-8 h-8 rounded-full flex items-center justify-center bg-white border border-zinc-200 shadow-xs text-zinc-900 disabled:opacity-50"
                >
                  +
                </button>
              </div>
            </motion.div>
          )}

          {/* Estimated Arrival Time */}
          {selectedRoomId && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="pt-2 border-t border-zinc-100"
            >
              <label className="text-sm font-semibold text-zinc-900 block mb-1.5">
                Estimated Arrival Time <span className="text-zinc-500 font-normal text-xs">(Optional)</span>
              </label>
              <select
                value={arrivalTime}
                onChange={(e) => setArrivalTime(e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-zinc-200 text-zinc-900 text-sm focus:outline-none focus:ring-1 focus:ring-black font-medium appearance-none bg-white"
              >
                <option value="">Not Sure Yet</option>
                <option value="2:00 PM - 4:00 PM">2:00 PM - 4:00 PM</option>
                <option value="4:00 PM - 6:00 PM">4:00 PM - 6:00 PM</option>
                <option value="After 6:00 PM">Late Arrival (After 6:00 PM)</option>
              </select>
              <span className="text-xs text-zinc-500 mt-1 block">
                Standard Check-in: 2:00 PM | Check-out: 12:00 PM
              </span>
            </motion.div>
          )}

          {/* Optional Add-ons */}
          {selectedRoomId && dateRange.from && dateRange.to && addons.length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }} 
              animate={{ opacity: 1, height: "auto" }}
              className="flex flex-col gap-2 pt-2 border-t border-zinc-100"
            >
              <h3 className="text-sm font-semibold text-zinc-900">Optional Add-ons</h3>
              <div className="grid gap-2">
                {addons.map(addon => {
                  const isSelected = selectedAddonIds.has(addon.id);
                  return (
                    <button
                      key={addon.id}
                      onClick={() => toggleAddon(addon.id)}
                      className={`w-full flex items-center justify-between p-3 rounded-xl border text-left transition-all ${
                        isSelected 
                          ? "border-black bg-zinc-50 ring-1 ring-black/5" 
                          : "border-zinc-200 hover:border-zinc-300"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`flex items-center justify-center w-5 h-5 rounded-full border ${isSelected ? 'bg-black border-black text-white' : 'border-zinc-300'}`}>
                          {isSelected && <CheckCircle2 className="w-3.5 h-3.5" />}
                        </div>
                        <div>
                          <p className="font-semibold text-sm text-zinc-900 flex items-center gap-1.5">
                            {getAddonIcon(addon.service_type)}
                            {addon.name}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-sm text-zinc-900">+₱{Number(addon.price).toLocaleString()}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </motion.div>
          )}

          {/* Price Breakdown & Cancellation Policy Box (Inside body!) */}
          {pricing && (
            <div className="space-y-4 pt-2 border-t border-zinc-100">
              <div className="rounded-xl border border-zinc-200 bg-zinc-50/80 p-4 text-sm space-y-2">
                <div className="flex items-center justify-between text-zinc-600">
                  <span className="font-medium text-zinc-700">Room Base ({nights} {nights === 1 ? 'night' : 'nights'})</span>
                  <span className="font-bold text-zinc-900">₱{pricing.roomTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
                {pricing.addonsTotal > 0 && (
                  <div className="flex items-center justify-between text-zinc-600">
                    <span className="font-medium text-zinc-700">Extra Services</span>
                    <span className="font-bold text-zinc-900">₱{pricing.addonsTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                )}
                <div className="flex items-center justify-between text-zinc-600">
                  <span className="font-medium text-zinc-700">Deposit ({pricing.resolvedPercent}% of room/addons)</span>
                  <span className="font-bold text-emerald-700">₱{(pricing.downpayment - pricing.convenienceFee).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
                <div className="flex items-center justify-between text-zinc-600">
                  <span className="font-medium text-zinc-700">Booking Service Fee</span>
                  <span className="font-bold text-zinc-900">₱{pricing.convenienceFee.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
                <div className="flex items-center justify-between font-bold text-sm text-zinc-900 pt-2 border-t border-zinc-200">
                  <span>Total Due Now</span>
                  <span className="text-emerald-600">₱{pricing.downpayment.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
                {pricing.balance > 0 && (
                  <div className="flex items-center justify-between font-bold text-sm text-zinc-900 pt-2 border-t border-zinc-200">
                    <span>Remaining Balance (due at check-in)</span>
                    <span className="text-zinc-800">₱{pricing.balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                )}
              </div>

              {/* Dynamic Cancellation Policy Snapshot Box */}
              {(() => {
                const summary = getPolicySummary(propertyPolicy, systemSettings);
                return (
                  <div 
                    ref={policyBoxRef}
                    className={cn(
                      "rounded-xl border p-3.5 text-xs text-amber-950 space-y-1.5 transition-all duration-300",
                      highlightPolicy
                        ? "border-amber-500 bg-amber-100 ring-4 ring-amber-400/50 shadow-md animate-pulse"
                        : "border-amber-200 bg-amber-50/80"
                    )}
                  >
                    <div className="font-bold flex items-center justify-between">
                      <span>{formatPolicyName(propertyPolicy)}</span>
                      <Link
                        href={`/terms?from=booking&propertyId=${propertyId}${
                          selectedRoomId ? `&roomId=${selectedRoomId}` : ""
                        }${
                          dateRange?.from
                            ? `&checkIn=${dateRange.from.getFullYear()}-${String(dateRange.from.getMonth() + 1).padStart(2, "0")}-${String(dateRange.from.getDate()).padStart(2, "0")}`
                            : ""
                        }${
                          dateRange?.to
                            ? `&checkOut=${dateRange.to.getFullYear()}-${String(dateRange.to.getMonth() + 1).padStart(2, "0")}-${String(dateRange.to.getDate()).padStart(2, "0")}`
                            : ""
                        }&guests=${guestCount}`}
                        className="text-amber-800 underline font-medium hover:text-black"
                      >
                        View Terms
                      </Link>
                    </div>
                    <p className="text-[11px] text-amber-900 leading-snug">
                      • {summary.tier1}
                    </p>
                    {summary.tier2 && (
                      <p className="text-[11px] text-amber-900 leading-snug">
                        • {summary.tier2}
                      </p>
                    )}
                    <p className="text-[11px] text-amber-900 leading-snug">
                      • {summary.tier3}
                    </p>
                    <p className="text-[11px] text-amber-900/90 leading-snug font-medium">
                      • {summary.feeRuleText}
                    </p>

                    <div className="pt-2 border-t border-amber-200/60 flex items-start gap-2.5">
                      <input 
                        type="checkbox"
                        id="policy-checkbox"
                        checked={policyAccepted}
                        onChange={(e) => {
                          setPolicyAccepted(e.target.checked);
                          if (e.target.checked) setHighlightPolicy(false);
                        }}
                        className="mt-0.5 h-4 w-4 rounded border-amber-400 text-black accent-black cursor-pointer"
                      />
                      <label htmlFor="policy-checkbox" className="text-[11px] font-semibold text-neutral-900 cursor-pointer select-none">
                        I understand and agree to the {formatPolicyName(propertyPolicy)} for this booking.
                      </label>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* Booking Error Banner - Inside body, directly above footer */}
          {errorMessage && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3.5 text-xs text-red-800 flex items-start gap-2.5">
              <AlertTriangle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold text-red-950">Booking Unavailable</p>
                <p className="mt-0.5 text-red-800">{errorMessage}</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer - Sticky, compact (64-72px), respecting safe-area */}
        <div className="shrink-0 border-t border-zinc-200 bg-white px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] flex items-center justify-between gap-3 min-h-[64px] max-h-[72px]">
          <div className="flex flex-col min-w-0">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 truncate">
              Total due now
            </span>
            <span className="text-base sm:text-lg font-bold text-zinc-900 leading-tight">
              {pricing ? `₱${pricing.downpayment.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—"}
            </span>
          </div>

          <div onClick={handleReserveClick}>
            <Button 
              type="button"
              className="h-10 sm:h-11 px-6 rounded-xl bg-black text-white hover:bg-neutral-800 disabled:bg-neutral-200 disabled:text-neutral-500 font-semibold text-sm transition-all shadow-sm shrink-0"
              disabled={!isFormValid || isSubmitting}
            >
              {isSubmitting ? "Requesting..." : "Send Booking Request"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
