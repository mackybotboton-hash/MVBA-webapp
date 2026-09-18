"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { differenceInDays } from "date-fns";
import { User, CalendarIcon, CheckCircle2 } from "lucide-react";

interface Room {
  id: string;
  name: string;
  base_price: number;
  max_capacity: number;
}

interface BookingRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  rooms: Room[];
  onSubmit: (payload: { roomId: string; checkInDate: string; checkOutDate: string; guestCount: number }) => void;
  isSubmitting?: boolean;
}

export function BookingRequestModal({ isOpen, onClose, rooms, onSubmit, isSubmitting = false }: BookingRequestModalProps) {
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<any>({});
  const [guestCount, setGuestCount] = useState<number>(1);

  const selectedRoom = useMemo(() => rooms.find(r => r.id === selectedRoomId), [rooms, selectedRoomId]);

  const nights = useMemo(() => {
    if (dateRange.from && dateRange.to) {
      return Math.max(1, differenceInDays(dateRange.to, dateRange.from));
    }
    return 0;
  }, [dateRange]);

  const pricing = useMemo(() => {
    if (!selectedRoom || nights === 0) return null;
    const total = selectedRoom.base_price * nights;
    return {
      total,
      downpayment: total * 0.20 // 20% downpayment required
    };
  }, [selectedRoom, nights]);

  // Adjust guest count if room changes
  if (selectedRoom && guestCount > selectedRoom.max_capacity) {
    setGuestCount(selectedRoom.max_capacity);
  }

  const isFormValid = selectedRoomId && dateRange.from && dateRange.to && guestCount > 0;

  const handleSubmit = () => {
    if (!isFormValid || !dateRange.from || !dateRange.to || !selectedRoomId) return;
    
    // Convert to ISO string (local date handling might be needed depending on DB setup)
    onSubmit({
      roomId: selectedRoomId,
      checkInDate: dateRange.from.toISOString().split("T")[0],
      checkOutDate: dateRange.to.toISOString().split("T")[0],
      guestCount
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden bg-white/95 backdrop-blur-xl border-zinc-200">
        <DialogHeader className="p-6 pb-2">
          <DialogTitle className="text-xl font-medium tracking-tight">Request to Book</DialogTitle>
          <DialogDescription className="text-zinc-500">
            Select a room tier and your travel dates.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-6 p-6 overflow-y-auto max-h-[70vh]">
          {/* Room Selection */}
          <div className="flex flex-col gap-3">
            <h3 className="text-sm font-medium text-zinc-900">Select Room Tier</h3>
            <div className="grid gap-3">
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
                        className={`w-full flex items-center justify-between p-4 rounded-2xl border text-left transition-all ${
                          isSelected 
                            ? "border-black bg-zinc-50 shadow-sm ring-1 ring-black/5" 
                            : "border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50/50"
                        }`}
                      >
                        <div>
                          <p className="font-medium text-zinc-900">{room.name}</p>
                          <p className="text-sm text-zinc-500 flex items-center gap-1 mt-1">
                            <User className="w-3.5 h-3.5" /> Max {room.max_capacity} guests
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-medium text-zinc-900">₱{room.base_price.toLocaleString()}</p>
                          <p className="text-xs text-zinc-500">per night</p>
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
              className="flex flex-col gap-3 overflow-hidden"
            >
              <h3 className="text-sm font-medium text-zinc-900">Travel Dates</h3>
              <div className="border border-zinc-200 rounded-2xl p-2 bg-white flex justify-center">
                <Calendar
                  mode="range"
                  selected={dateRange}
                  onSelect={(range) => setDateRange(range as any)}
                  numberOfMonths={1}
                  disabled={(date) => date < new Date(new Date().setHours(0,0,0,0))}
                  className="rounded-md"
                />
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
                <p className="text-sm font-medium text-zinc-900">Guests</p>
                <p className="text-xs text-zinc-500">This room allows up to {selectedRoom?.max_capacity}</p>
              </div>
              <div className="flex items-center gap-4 bg-zinc-50 p-1 rounded-full border border-zinc-200">
                <button 
                  onClick={() => setGuestCount(prev => Math.max(1, prev - 1))}
                  disabled={guestCount <= 1}
                  className="w-8 h-8 rounded-full flex items-center justify-center bg-white border border-zinc-200 shadow-sm text-zinc-900 disabled:opacity-50"
                >
                  -
                </button>
                <span className="w-4 text-center font-medium text-sm">{guestCount}</span>
                <button 
                  onClick={() => setGuestCount(prev => Math.min(selectedRoom?.max_capacity || 1, prev + 1))}
                  disabled={guestCount >= (selectedRoom?.max_capacity || 1)}
                  className="w-8 h-8 rounded-full flex items-center justify-center bg-white border border-zinc-200 shadow-sm text-zinc-900 disabled:opacity-50"
                >
                  +
                </button>
              </div>
            </motion.div>
          )}
        </div>

        {/* Sticky Pricing Footer */}
        <AnimatePresence>
          {pricing && (
            <motion.div 
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              className="border-t border-zinc-200 bg-zinc-50 p-4 sm:p-6 pb-6 sm:pb-6"
            >
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-1">Total • {nights} {nights === 1 ? 'night' : 'nights'}</p>
                  <p className="text-lg font-semibold text-zinc-900">₱{pricing.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-medium text-blue-600 uppercase tracking-wider mb-1">Required Deposit (20%)</p>
                  <p className="text-lg font-semibold text-blue-700">₱{pricing.downpayment.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                </div>
              </div>
              
              <Button 
                className="w-full rounded-xl py-6 text-base font-medium shadow-sm transition-all active:scale-[0.98]"
                disabled={!isFormValid || isSubmitting}
                onClick={handleSubmit}
              >
                {isSubmitting ? "Requesting..." : "Send Booking Request"}
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}
