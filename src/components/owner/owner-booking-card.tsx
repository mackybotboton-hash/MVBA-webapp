"use client";

import * as React from "react";
import Link from "next/link";
import { calculatePayout } from "@/lib/payout-helper";
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
  Receipt,
  AlertCircle,
  Loader2,
  Copy,
  Upload,
  Image as ImageIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { submitHostRefundProofAction } from "@/app/actions/booking-actions";
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
  receipt_url?: string;
  commission_amount?: number;
  convenience_fee?: number;
  addons?: { name: string; price: number; commission: number }[];
  cancelled_by?: "tourist" | "host" | "admin" | null;
  cancelled_at?: string | null;
  cancellation_reason?: string | null;
  refund_total?: number | null;
  host_refund_amount?: number | null;
  host_refund_status?: "none" | "pending" | "sent" | string | null;
  host_refund_due_at?: string | null;
  host_refund_receipt_url?: string | null;
  refund_gcash_number?: string | null;
}

export interface OwnerBookingCardProps {
  booking: OwnerBookingItem;
  onUpdateStatus: (
    bookingId: string,
    newStatus: "accepted" | "declined" | "cancelled",
    reason?: string
  ) => Promise<void>;
  onViewPayoutReceipt?: (receiptUrl: string) => void;
  chatHrefPrefix?: string;
  className?: string;
}

export function OwnerBookingCard({
  booking,
  onUpdateStatus,
  onViewPayoutReceipt,
  chatHrefPrefix = "/homestay/chat",
  className,
}: OwnerBookingCardProps) {
  const [isUpdating, setIsUpdating] = React.useState(false);
  const [isCancelDialogOpen, setIsCancelDialogOpen] = React.useState(false);
  const [isUploadProofOpen, setIsUploadProofOpen] = React.useState(false);
  const [cancelReason, setCancelReason] = React.useState("Property maintenance / unavailable");
  const [customCancelReason, setCustomCancelReason] = React.useState("");

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

  const handleAction = async (
    status: "accepted" | "declined" | "cancelled",
    reason?: string
  ) => {
    setIsUpdating(true);
    try {
      await onUpdateStatus(booking.id, status, reason);
      if (status === "cancelled") {
        setIsCancelDialogOpen(false);
      }
    } finally {
      setIsUpdating(false);
    }
  };

  const getAcceptedStatusConfig = () => {
    switch (booking.payment_status) {
      case "awaiting_deposit":
        return { label: "Awaiting Deposit", variant: "warning" as const, icon: Clock };
      case "deposit_uploaded":
        return { label: "Verifying Deposit", variant: "warning" as const, icon: Clock };
      case "verified":
        return { label: "Confirmed Booking", variant: "success" as const, icon: CheckCircle2 };
      default:
        return { label: "Awaiting Deposit", variant: "warning" as const, icon: Clock };
    }
  };

  const statusConfig = {
    pending: {
      label: "Pending Your Approval",
      variant: "warning" as const,
      icon: Clock,
    },
    accepted: getAcceptedStatusConfig(),
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
            {(booking.payout_status === "deposit_paid" || booking.payout_status === "fully_paid") && (
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
          {booking.downpayment_amount ? (() => {
            const payouts = calculatePayout({
              totalPrice: booking.total_price,
              downpaymentAmount: booking.downpayment_amount,
              commissionAmount: booking.commission_amount,
              convenienceFee: booking.convenience_fee,
              depositPayoutAmount: (booking as any).deposit_payout_amount,
            });
            const hostDeposit = payouts.depositPayout;
            const collectAtCheckin = payouts.balancePayout;
            const isDepositPaid = booking.payout_status === "deposit_paid" || booking.payout_status === "fully_paid";

            if (booking.status === "cancelled") {
              const retained = Number((booking as any).adjusted_host_payout_amount || 0);
              return (
                <div className="flex flex-col items-end mt-1 space-y-0.5">
                  {retained > 0 ? (
                    <span className="text-[11px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded">
                      Retained Host Share: ₱{retained.toLocaleString()}
                    </span>
                  ) : (
                    <span className="text-[11px] text-red-600 font-semibold bg-red-50 px-2 py-0.5 rounded">
                      Cancelled • Check-in Voided
                    </span>
                  )}
                </div>
              );
            }

            return (
              <div className="flex flex-col items-end mt-1 space-y-0.5">
                <span className="text-[11px] text-green-700 font-medium">
                  Panaw sends you after verification: ₱{hostDeposit.toLocaleString()}
                  {isDepositPaid && " (Paid to GCash)"}
                </span>
                <span className="text-[11px] text-amber-600 font-semibold bg-amber-50 px-1.5 py-0.5 rounded">
                  Collect at Check-in: ₱{collectAtCheckin.toLocaleString()}
                </span>
              </div>
            );
          })() : (
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

      {/* Itemized Breakdown Section */}
      <div className="bg-neutral-50/50 border-t border-b border-neutral-100 px-5 py-4 text-xs">
        <h4 className="font-semibold text-neutral-800 mb-3 flex items-center gap-1.5">
          <Receipt className="h-4 w-4 text-neutral-500" />
          Financial Breakdown
        </h4>
        <div className="space-y-2">
          {/* Room Base */}
          <div className="flex justify-between items-center text-neutral-600">
            <span>Room Base Price ({diffDays} {diffDays === 1 ? "night" : "nights"})</span>
            <span>₱{((booking.total_price - (booking.convenience_fee || 0)) - (booking.addons?.reduce((sum, a) => sum + a.price, 0) || 0)).toLocaleString()}</span>
          </div>

          {/* Add-ons */}
          {booking.addons && booking.addons.length > 0 && (
            <div className="space-y-1">
              <span className="text-neutral-500 font-medium block mt-1">Extra Services:</span>
              {booking.addons.map((addon, idx) => (
                <div key={idx} className="flex justify-between items-center text-neutral-600 pl-2">
                  <span>- {addon.name}</span>
                  <span>₱{addon.price.toLocaleString()}</span>
                </div>
              ))}
            </div>
          )}
          
          <div className="border-t border-neutral-200/60 my-2"></div>
          
          <div className="flex justify-between items-center font-medium text-neutral-700">
            <span>Subtotal (Room + Services)</span>
            <span>₱{(booking.total_price - (booking.convenience_fee || 0)).toLocaleString()}</span>
          </div>

          {/* Platform Deductions */}
          <div className="flex justify-between items-center text-red-600/80">
            <span>Platform Commission (-{Math.round(((booking.commission_amount || 0) / (booking.total_price - (booking.convenience_fee || 0))) * 100)}%)</span>
            <span>- ₱{booking.commission_amount?.toLocaleString()}</span>
          </div>

          <div className="border-t border-neutral-200/60 my-2"></div>

          {/* Final Payout */}
          <div className="flex justify-between items-center font-bold text-neutral-900 text-sm">
            <span>{booking.status === "cancelled" ? "Cancelled Reservation Payout" : "Net Earnings (Your Payout)"}</span>
            <span className={cn(booking.status === "cancelled" ? "text-neutral-700 font-semibold" : "text-emerald-700")}>
              {booking.status === "cancelled"
                ? `₱${Number((booking as any).adjusted_host_payout_amount || 0).toLocaleString()}`
                : `₱${(booking.host_payout_amount || ((booking.total_price - (booking.convenience_fee || 0)) - (booking.commission_amount || 0))).toLocaleString()}`
              }
            </span>
          </div>

          {/* Informational Note for Guest Convenience Fee */}
          <p className="text-[11px] text-neutral-500 pt-1">
            * Note: Guest pays a separate ₱{(booking.convenience_fee || 100).toLocaleString()} convenience fee directly to Panaw (not deducted from your earnings).
          </p>

          {/* Cancellation & Refund Alert Banner */}
          {booking.status === "cancelled" && (
            <div className="rounded-xl border border-red-200 bg-red-50/70 p-3.5 space-y-2 mt-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-red-900 flex items-center gap-1.5">
                  <AlertCircle className="h-4 w-4 text-red-600" />
                  Booking Cancelled
                </span>
                <Badge variant="outline" className="text-[10px] bg-white border-red-200 text-red-800 capitalize font-medium">
                  By {booking.cancelled_by === "host" ? "You (Host)" : booking.cancelled_by === "tourist" ? "Guest" : (booking.cancelled_by || "Guest")}
                </Badge>
              </div>

              {booking.cancellation_reason && (
                <p className="text-neutral-700 italic bg-white/70 p-2 rounded-lg border border-red-100">
                  &ldquo;{booking.cancellation_reason}&rdquo;
                </p>
              )}

              {(!booking.host_refund_amount || booking.host_refund_amount === 0) && (
                <div className="rounded-lg bg-neutral-100/90 p-2.5 border border-neutral-200/80 text-[11px] text-neutral-700 mt-2 space-y-1">
                  <p className="font-semibold text-neutral-900 flex items-center gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                    Deposit & Payout Status:
                  </p>
                  <p className="text-neutral-600">
                    {booking.payout_status === "deposit_paid"
                      ? "Deposit payout was retained by host according to policy. No refund return required."
                      : "No deposit return required from host. The guest refund is handled directly by Panaw platform from held funds."}
                  </p>
                </div>
              )}

              {booking.host_refund_amount != null && booking.host_refund_amount > 0 && (
                <div className={cn(
                  "rounded-xl border p-3.5 space-y-2 mt-2",
                  booking.host_refund_status === "sent" ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-amber-300 bg-amber-50 text-amber-900"
                )}>
                  <div className="flex items-center justify-between font-bold">
                    <span>Host Payout Refund Due: ₱{booking.host_refund_amount.toLocaleString()}</span>
                    <Badge variant="outline" className="text-[10px] bg-white capitalize">
                      {booking.host_refund_status === "sent" ? "Proof Submitted" : "Pending Return"}
                    </Badge>
                  </div>

                  <p className="text-[11px] leading-relaxed">
                    {booking.host_refund_status === "sent"
                      ? "You have submitted the return proof for this deposit payout."
                      : `Because this booking was cancelled under a refund-eligible policy after your deposit payout was disbursed, you are required to return ₱${booking.host_refund_amount.toLocaleString()} to Panaw platform ${booking.host_refund_due_at ? `by ${formatDate(new Date(booking.host_refund_due_at))}` : "within 72 hours"}.`}
                  </p>

                  {booking.refund_gcash_number && (
                    <div className="flex items-center justify-between text-[11px] bg-white/80 p-2 rounded-lg border border-amber-200">
                      <span className="text-neutral-700 font-medium">Guest GCash Number:</span>
                      <div className="flex items-center gap-1">
                        <span className="font-mono font-bold text-neutral-900">{booking.refund_gcash_number}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-1.5 text-neutral-600 hover:text-black"
                          onClick={() => {
                            navigator.clipboard.writeText(booking.refund_gcash_number!);
                            toast.success("Guest GCash number copied to clipboard!");
                          }}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  )}

                  {booking.host_refund_due_at && booking.host_refund_status === "pending" && (
                    <div className="text-[11px] font-semibold flex items-center justify-between pt-1 border-t border-amber-200/80">
                      <span>Return Deadline:</span>
                      <span className={cn(
                        new Date(booking.host_refund_due_at).getTime() < Date.now() ? "text-red-700 font-extrabold" : "text-amber-800"
                      )}>
                        {formatDate(new Date(booking.host_refund_due_at))}
                        {new Date(booking.host_refund_due_at).getTime() < Date.now() ? " (OVERDUE)" : ` (${Math.max(1, Math.round((new Date(booking.host_refund_due_at).getTime() - Date.now()) / (1000 * 60 * 60)))}h left)`}
                      </span>
                    </div>
                  )}

                  <div className="pt-2 flex flex-wrap gap-2">
                    {booking.host_refund_status === "pending" && (
                      <Button
                        size="sm"
                        className="text-xs h-7 px-3 bg-amber-800 text-white hover:bg-amber-900"
                        onClick={() => setIsUploadProofOpen(true)}
                      >
                        <Upload className="h-3 w-3 mr-1" />
                        Submit Return Receipt
                      </Button>
                    )}
                    {booking.host_refund_receipt_url && onViewPayoutReceipt && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs h-7 px-2.5 border-neutral-300 bg-white"
                        onClick={() => onViewPayoutReceipt(booking.host_refund_receipt_url!)}
                      >
                        <Receipt className="h-3 w-3 mr-1" />
                        View Return Receipt
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Action Footer */}
      <div className="pt-4 border-t border-neutral-100 flex flex-wrap items-center justify-between gap-3">
        <span className="text-[11px] font-medium text-neutral-600">
          Booking ID: #{booking.id.slice(0, 8)}
        </span>

        <div className="flex items-center gap-2">
          {(booking.payout_status === "deposit_paid" || booking.payout_status === "fully_paid") &&
            booking.receipt_url &&
            (booking.receipt_url.includes("payout:") || booking.receipt_url.includes("deposit_payout:")) &&
            onViewPayoutReceipt && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const parts = booking.receipt_url!.split(/\|\|(?:deposit_)?payout:|(?:deposit_)?payout:/);
                const payoutPart = parts[parts.length - 1];
                if (payoutPart) onViewPayoutReceipt(payoutPart);
              }}
              className="text-xs h-8 px-3 border-green-200 text-green-700 hover:bg-green-50"
            >
              <Receipt className="h-3.5 w-3.5 mr-1" />
              View Payout Receipt
            </Button>
          )}

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
          {booking.status === "accepted" && (
            <Dialog open={isCancelDialogOpen} onOpenChange={setIsCancelDialogOpen}>
              <DialogTrigger render={
                <Button
                  variant="outline"
                  size="sm"
                  disabled={isUpdating}
                  className="text-xs h-8 px-3 border-neutral-200 text-red-600 hover:bg-red-50 hover:border-red-200"
                />
              }>
                <X className="h-3.5 w-3.5 mr-1" />
                Cancel Booking
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle className="text-lg font-bold text-neutral-900">Cancel Confirmed Booking</DialogTitle>
                  <DialogDescription className="text-xs text-neutral-500">
                    Guest: {booking.tourist_name} • Check-in: {booking.check_in_date}
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-3.5 py-1 text-xs">
                  <div className="rounded-xl border border-red-200 bg-red-50/70 p-3.5 text-red-900 space-y-1.5">
                    <p className="font-semibold flex items-center gap-1.5">
                      <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />
                      Host Cancellation Policy &amp; 100% Guest Refund
                    </p>
                    <p className="text-[11px] leading-relaxed text-red-800">
                      When a host cancels a confirmed reservation, the guest is entitled to a <strong>100% full refund</strong> of their deposit and platform fees.
                    </p>
                    {(booking.payout_status === "deposit_paid" || booking.payout_status === "fully_paid") && (
                      <p className="text-[11px] font-semibold text-red-900 pt-1 border-t border-red-200">
                        ⚠️ Notice: You have already received a deposit payout. You will be required to return the payout funds to Panaw within 72 hours.
                      </p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-semibold text-neutral-800 block">
                      Cancellation Reason <span className="text-red-500">*</span>
                    </label>
                    <select
                      className="w-full rounded-md border border-neutral-300 bg-white p-2 text-xs text-neutral-800 focus:outline-none focus:ring-1 focus:ring-emerald-600"
                      value={cancelReason}
                      onChange={(e) => setCancelReason(e.target.value)}
                    >
                      <option value="Property maintenance / unavailable">Property maintenance / unavailable</option>
                      <option value="Double booking / scheduling error">Double booking / scheduling error</option>
                      <option value="Severe weather / safety concern">Severe weather / safety concern</option>
                      <option value="Personal emergency">Personal emergency</option>
                      <option value="Other">Other</option>
                    </select>
                    {cancelReason === "Other" && (
                      <Input
                        type="text"
                        placeholder="Please state specific reason..."
                        value={customCancelReason}
                        maxLength={200}
                        onChange={(e) => setCustomCancelReason(e.target.value)}
                        className="text-xs mt-1.5"
                      />
                    )}
                  </div>
                </div>

                <DialogFooter className="gap-2 sm:gap-0">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsCancelDialogOpen(false)}
                    disabled={isUpdating}
                  >
                    Keep Booking
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    disabled={isUpdating}
                    onClick={() => {
                      const finalReason = cancelReason === "Other"
                        ? (customCancelReason.trim() || "Host cancelled booking")
                        : cancelReason;
                      handleAction("cancelled", finalReason);
                    }}
                  >
                    {isUpdating ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                        Cancelling...
                      </>
                    ) : (
                      "Yes, Cancel Booking"
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}

          <HostRefundUploadModal
            booking={booking}
            isOpen={isUploadProofOpen}
            onOpenChange={setIsUploadProofOpen}
          />
        </div>
      </div>
    </div>
  );
}

function HostRefundUploadModal({
  booking,
  isOpen,
  onOpenChange,
}: {
  booking: OwnerBookingItem;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
  const [isUploading, setIsUploading] = React.useState(false);

  React.useEffect(() => {
    if (!isOpen) {
      setSelectedFile(null);
      setPreviewUrl(null);
      setIsUploading(false);
    }
  }, [isOpen]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      toast.error("Please choose a receipt screenshot or photo to upload.");
      return;
    }

    try {
      setIsUploading(true);
      const ext = selectedFile.name.split(".").pop() || "jpg";
      const filePath = `host-refunds/refund-${booking.id}-${Date.now()}.${ext}`;

      const supabase = createClient();
      const { data: uploadData, error: uploadErr } = await supabase.storage
        .from("payment-receipts")
        .upload(filePath, selectedFile);

      if (uploadErr) throw uploadErr;

      const res = await submitHostRefundProofAction({
        bookingId: booking.id,
        receiptPath: uploadData.path,
      });

      if (!res.success) throw new Error(res.error);

      toast.success("Return receipt submitted successfully!", {
        description: "Admin and guest have been updated.",
      });
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to upload return receipt.");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-neutral-900">
            Submit Host Refund Return Proof
          </DialogTitle>
          <DialogDescription className="text-xs text-neutral-500">
            Booking #{booking.id.slice(0, 8)} • Due: ₱{(booking.host_refund_amount || 0).toLocaleString()}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3.5 py-1 text-xs">
          <div className="bg-amber-50 border border-amber-200 text-amber-900 p-3 rounded-xl text-xs space-y-1">
            <p className="font-semibold">Required Payout Leg Return</p>
            <p className="text-[11px] leading-relaxed">
              Please transfer <strong>₱{(booking.host_refund_amount || 0).toLocaleString()}</strong> to the guest via GCash ({booking.refund_gcash_number || "Direct coordination"}) or to Panaw Platform, then upload the confirmation receipt below.
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="font-semibold text-neutral-800 block">
              GCash Transfer Screenshot <span className="text-red-500">*</span>
            </label>
            <Input
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="text-xs"
            />
          </div>

          {previewUrl && (
            <div className="relative rounded-xl overflow-hidden border border-neutral-200 aspect-video max-h-48 w-full bg-neutral-100 flex items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={previewUrl} alt="Receipt preview" className="object-contain h-full w-full" />
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={isUploading}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            className="bg-black text-white hover:bg-neutral-800"
            disabled={isUploading || !selectedFile}
            onClick={handleUpload}
          >
            {isUploading ? (
              <>
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                Uploading...
              </>
            ) : (
              "Confirm & Submit"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
