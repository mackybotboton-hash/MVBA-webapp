"use client";

import * as React from "react";
import Link from "next/link";
import {
  Calendar,
  Users,
  Check,
  X,
  Clock,
  CheckCircle2,
  XCircle,
  MessageSquare,
  Phone,
  PhilippinePeso,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface OwnerBookingItem {
  id: string;
  tourist_id: string;
  tourist_name: string;
  tourist_phone?: string;
  tourist_email?: string;
  room_id: string;
  room_name: string;
  check_in_date: string;
  check_out_date: string;
  guest_count: number;
  total_price: number;
  downpayment_amount?: number;
  host_payout_amount?: number;
  payment_status?: "awaiting_deposit" | "deposit_uploaded" | "verified" | "completed" | "refunded";
  status: "pending" | "accepted" | "declined" | "cancelled" | "completed";
  created_at?: string;
  notes?: string;
  payout_status?: string;
}

export interface OwnerBookingCardProps {
  booking: OwnerBookingItem;
  onUpdateStatus: (bookingId: string, newStatus: "accepted" | "declined") => Promise<void>;
  chatHrefPrefix?: string;
  className?: string;
}

export function OwnerBookingCard({
  booking,
  onUpdateStatus,
  chatHrefPrefix = "/homestay/chat",
  className,
}: OwnerBookingCardProps) {
  const [isUpdating, setIsUpdating] = React.useState(false);

  const checkIn = new Date(booking.check_in_date);
  const checkOut = new Date(booking.check_out_date);
  const diffTime = Math.abs(checkOut.getTime() - checkIn.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) || 1;

  const formatDate = (d: Date) =>
    d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });

  const handleAction = async (status: "accepted" | "declined") => {
    setIsUpdating(true);
    try {
      await onUpdateStatus(booking.id, status);
    } finally {
      setIsUpdating(false);
    }
  };

  const statusConfig = {
    pending: {
      label: "Pending Your Approval",
      variant: "warning" as const,
      icon: Clock,
    },
    accepted: {
      label: "Confirmed Booking",
      variant: "success" as const,
      icon: CheckCircle2,
    },
    declined: {
      label: "Declined",
      variant: "destructive" as const,
      icon: XCircle,
    },
    cancelled: {
      label: "Guest Cancelled",
      variant: "outline" as const,
      icon: XCircle,
    },
    completed: {
      label: "Stay Completed",
      variant: "secondary" as const,
      icon: CheckCircle2,
    },
  };

  const currentStatus = statusConfig[booking.status] || statusConfig.pending;
  const StatusIcon = currentStatus.icon;

  return (
    <div
      className={cn(
        "rounded-2xl border border-neutral-200 bg-white p-5 shadow-xs transition-all relative",
        booking.status === "pending"
          ? "border-neutral-300 ring-1 ring-black/5"
          : "hover:border-neutral-300",
        className
      )}
    >
      {/* Header: Guest Info & Status */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-neutral-100 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-base text-neutral-900">
              {booking.tourist_name || "Tourist Guest"}
            </h3>
            {/* Payout Paid Badge */}
            {booking.payout_status === "paid" && (
              <div className="absolute -top-3 -right-3">
                <Badge variant="success" className="shadow-sm border-white border-2">
                  Payout Paid
                </Badge>
              </div>
            )}
            <Badge variant={currentStatus.variant} className="gap-1 text-xs">
              <StatusIcon className="h-3 w-3" />
              <span>{currentStatus.label}</span>
            </Badge>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs font-medium text-neutral-600 mt-1">
            <span>{booking.room_name}</span>
            {booking.tourist_phone && (
              <span className="flex items-center gap-1.5 text-neutral-700">
                <Phone className="h-3 w-3 text-neutral-600" />
                {booking.tourist_phone}
              </span>
            )}
          </div>
        </div>

        <div className="text-left sm:text-right flex flex-col items-end">
          <span className="text-lg font-bold text-neutral-900 block">
            ₱{booking.total_price.toLocaleString()}
          </span>
          {booking.downpayment_amount ? (
            <div className="flex flex-col items-end mt-1 space-y-0.5">
              <span className="text-[11px] text-green-700 font-medium">
                Deposit (Your Share): ₱{booking.host_payout_amount?.toLocaleString() || 0}
                {booking.payout_status === "paid" && " (Paid to GCash)"}
              </span>
              <span className="text-[11px] text-amber-600 font-semibold bg-amber-50 px-1.5 py-0.5 rounded">
                Collect at Check-in: ₱{(booking.total_price - booking.downpayment_amount).toLocaleString()}
              </span>
            </div>
          ) : (
            <span className="text-[11px] font-medium text-neutral-600">
              {diffDays} {diffDays === 1 ? "night" : "nights"} stay
            </span>
          )}
        </div>
      </div>

      {/* Booking Dates & Capacity */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 py-4 text-xs">
        <div>
          <span className="text-neutral-600 block font-semibold">Check-in</span>
          <p className="font-bold text-neutral-900 mt-0.5">
            {formatDate(checkIn)}
          </p>
          <span className="text-[10px] text-neutral-600 font-medium">Standard 2:00 PM</span>
        </div>

        <div>
          <span className="text-neutral-600 block font-semibold">Check-out</span>
          <p className="font-bold text-neutral-900 mt-0.5">
            {formatDate(checkOut)}
          </p>
          <span className="text-[10px] text-neutral-600 font-medium">Standard 12:00 PM</span>
        </div>

        <div>
          <span className="text-neutral-600 block font-semibold">Party Size</span>
          <p className="font-bold text-neutral-900 mt-0.5 flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5 text-neutral-600" />
            {booking.guest_count} {booking.guest_count === 1 ? "Guest" : "Guests"}
          </p>
        </div>

        {booking.notes && (
          <div className="col-span-2 sm:col-span-3 mt-2 rounded-lg bg-blue-50/50 p-2.5 border border-blue-100">
            <span className="text-blue-600 block font-medium text-[10px] uppercase tracking-wider mb-1">
              Guest Notes & Arrival
            </span>
            <p className="text-neutral-700 text-xs leading-relaxed">
              {booking.notes}
            </p>
          </div>
        )}
      </div>

      {/* Action Footer */}
      <div className="pt-4 border-t border-neutral-100 flex flex-wrap items-center justify-between gap-3">
        <span className="text-[11px] font-medium text-neutral-600">
          Booking ID: #{booking.id.slice(0, 8)}
        </span>

        <div className="flex items-center gap-2">
          <Link href={`${chatHrefPrefix}?guest=${booking.tourist_id}`}>
            <Button
              variant="outline"
              size="sm"
              className="text-xs h-8 px-3 border-neutral-200 text-neutral-700 hover:bg-neutral-100"
            >
              <MessageSquare className="h-3.5 w-3.5 mr-1" />
              Chat Guest
            </Button>
          </Link>

          {booking.status === "pending" && (
            <>
              <Button
                variant="outline"
                size="sm"
                disabled={isUpdating}
                onClick={() => handleAction("declined")}
                className="text-xs h-8 px-3 border-neutral-200 text-red-600 hover:bg-red-50 hover:border-red-200"
              >
                <X className="h-3.5 w-3.5 mr-1" />
                Decline
              </Button>

              <Button
                size="sm"
                disabled={isUpdating}
                onClick={() => handleAction("accepted")}
                className="text-xs h-8 px-4 bg-black text-white hover:bg-neutral-800 font-semibold"
              >
                <Check className="h-3.5 w-3.5 mr-1" />
                Accept Booking
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
