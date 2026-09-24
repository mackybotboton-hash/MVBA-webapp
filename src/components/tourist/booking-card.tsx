"use client";

import * as React from "react";
import Link from "next/link";
import {
  Calendar,
  Users,
  MapPin,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  MessageSquare,
  ChevronRight,
  Receipt,
  QrCode,
  Star,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export interface BookingData {
  id: string;
  property_id?: string;
  property_name: string;
  property_type?: "homestay" | "resort";
  room_name: string;
  check_in_date: string;
  check_out_date: string;
  guest_count: number;
  total_price: number;
  downpayment_amount?: number;
  payment_status?: "awaiting_deposit" | "deposit_uploaded" | "verified" | "completed" | "refunded";
  receipt_url?: string;
  status: "pending" | "accepted" | "declined" | "cancelled" | "completed";
  created_at?: string;
  owner_id?: string;
}

export interface BookingCardProps {
  booking: BookingData;
  onCancelBooking?: (bookingId: string) => void;
  onViewBoardingPass?: (booking: BookingData) => void;
  onPayDeposit?: (booking: BookingData) => void;
  onViewPayment?: (booking: BookingData) => void;
  onRateStay?: (booking: BookingData) => void;
  className?: string;
}

export function BookingCard({
  booking,
  onCancelBooking,
  onViewBoardingPass,
  onPayDeposit,
  onViewPayment,
  onRateStay,
  className,
}: BookingCardProps) {
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

  const formattedTotal = new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 0,
  }).format(booking.total_price);

  const statusConfig = {
    pending: {
      label: "Pending Confirmation",
      variant: "warning" as const,
      icon: Clock,
      description: "Waiting for property owner to approve",
    },
    accepted: {
      label: "Confirmed",
      variant: "success" as const,
      icon: CheckCircle2,
      description: "Your reservation is secured",
    },
    declined: {
      label: "Declined",
      variant: "destructive" as const,
      icon: XCircle,
      description: "Owner could not accommodate dates",
    },
    cancelled: {
      label: "Cancelled",
      variant: "outline" as const,
      icon: AlertCircle,
      description: "This booking was cancelled",
    },
    completed: {
      label: "Completed",
      variant: "secondary" as const,
      icon: CheckCircle2,
      description: "Stay completed",
    },
  };

  let currentStatus = statusConfig[booking.status] || statusConfig.pending;
  
  if (booking.status === "accepted") {
    if (booking.payment_status === "awaiting_deposit") {
      currentStatus = {
        label: "Awaiting Deposit",
        variant: "warning" as const,
        icon: Clock,
        description: "Please upload your GCash deposit receipt",
      };
    } else if (booking.payment_status === "deposit_uploaded") {
      currentStatus = {
        label: "Verifying Deposit",
        variant: "secondary" as const,
        icon: Clock,
        description: "Admin is verifying your payment",
      };
    }
  }

  const StatusIcon = currentStatus.icon;

  return (
    <div
      className={cn(
        "flex flex-col rounded-2xl border border-neutral-200 bg-white p-5 shadow-xs hover:border-neutral-300 transition-all",
        className
      )}
    >
      {/* Header: Property & Status */}
      <div className="flex items-start justify-between gap-3 border-b border-neutral-100 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-base text-neutral-900">
              {booking.property_name}
            </h3>
            {booking.property_type && (
              <Badge variant="subtle" size="sm" className="capitalize">
                {booking.property_type}
              </Badge>
            )}
          </div>
          <p className="text-xs font-medium text-neutral-600 mt-0.5">
            {booking.room_name}
          </p>
        </div>

        <Badge variant={currentStatus.variant} className="shrink-0 gap-1">
          <StatusIcon className="h-3 w-3" />
          <span>{currentStatus.label}</span>
        </Badge>
      </div>

      {/* Booking Details Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 py-4 text-xs">
        <div>
          <span className="text-neutral-500 font-medium block">Dates</span>
          <p className="font-medium text-neutral-800 mt-0.5">
            {formatDate(checkIn)} – {formatDate(checkOut)}
          </p>
          <span className="text-[11px] font-medium text-neutral-600">
            {diffDays} {diffDays === 1 ? "night" : "nights"}
          </span>
        </div>

        <div>
          <span className="text-neutral-500 font-medium block">Guests</span>
          <p className="font-medium text-neutral-800 mt-0.5 flex items-center gap-1">
            <Users className="h-3.5 w-3.5 text-neutral-600" />
            {booking.guest_count} {booking.guest_count === 1 ? "Guest" : "Guests"}
          </p>
        </div>

        <div className="col-span-2 sm:col-span-1">
          <span className="text-neutral-500 font-medium block">Total</span>
          <p className="font-bold text-sm text-neutral-900 mt-0.5">
            {formattedTotal}
          </p>
          <span className="text-[10px] text-neutral-500">
            Taxes & fees included
          </span>
        </div>
      </div>

      {/* Actions footer */}
      <div className="pt-4 border-t border-neutral-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <p className="text-[11px] text-neutral-500">
          Booking ID: #{booking.id.slice(0, 8)}
        </p>

        <div className="flex flex-wrap items-center gap-2">
          {onViewBoardingPass && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onViewBoardingPass(booking)}
              className="text-xs h-8 px-2.5 border-neutral-300 font-semibold hover:bg-neutral-50"
            >
              <QrCode className="h-3.5 w-3.5 mr-1 text-neutral-700" />
              Boarding Pass QR
            </Button>
          )}

          {booking.owner_id && (
            <Link href={`/chat?recipient=${booking.owner_id}`}>
              <Button
                variant="outline"
                size="sm"
                className="text-xs h-8 px-3 border-neutral-200"
              >
                <MessageSquare className="h-3.5 w-3.5 mr-1" />
                Chat Host
              </Button>
            </Link>
          )}

          {(booking.status === "pending" || booking.status === "accepted") && onCancelBooking && (
            <Dialog>
              <DialogTrigger render={<Button variant="outline" size="sm" className="text-xs h-8 px-3 border-neutral-200 text-red-600 hover:bg-red-50 hover:border-red-200" />}>
                Cancel {booking.status === "accepted" ? "Booking" : "Request"}
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Cancel Booking</DialogTitle>
                  <DialogDescription>
                    {booking.status === "accepted" 
                      ? "Are you sure you want to cancel this confirmed booking? As per our policy, your downpayment is non-refundable."
                      : "Are you sure you want to cancel your booking request?"}
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <DialogClose render={<Button variant="outline" size="sm" />}>Keep Booking</DialogClose>
                  <DialogClose render={<Button variant="destructive" size="sm" onClick={() => onCancelBooking(booking.id)} />}>
                    Yes, Cancel
                  </DialogClose>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}

          {booking.status === "accepted" && booking.payment_status === "awaiting_deposit" && (
            <Button
              size="sm"
              className="text-xs h-8 px-3 bg-blue-600 text-white hover:bg-blue-700"
              onClick={() => {
                if (onPayDeposit) {
                  onPayDeposit(booking);
                } else {
                  toast.info("Please upload your GCash deposit receipt.", {
                    description: "This feature is being developed.",
                  });
                }
              }}
            >
              <Receipt className="h-3.5 w-3.5 mr-1" />
              Pay Deposit
            </Button>
          )}

          {booking.receipt_url && onViewPayment && (
            <Button
              size="sm"
              variant="outline"
              className="text-xs h-8 px-3 border-blue-200 text-blue-600 hover:bg-blue-50"
              onClick={() => onViewPayment(booking)}
            >
              <Receipt className="h-3.5 w-3.5 mr-1" />
              View Payment
            </Button>
          )}

          {booking.status === "completed" && onRateStay && (
            <Button
              size="sm"
              variant="outline"
              className="text-xs h-8 px-3 border-amber-200 text-amber-700 hover:bg-amber-50"
              onClick={() => onRateStay(booking)}
            >
              <Star className="h-3.5 w-3.5 mr-1 fill-amber-400 text-amber-400" />
              Rate Stay
            </Button>
          )}

          {booking.property_id && (
            <Link href={`/property/${booking.property_id}`}>
              <Button
                size="sm"
                className="text-xs h-8 px-3 bg-black text-white hover:bg-neutral-800"
              >
                View Stay
                <ChevronRight className="h-3 w-3 ml-0.5" />
              </Button>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
