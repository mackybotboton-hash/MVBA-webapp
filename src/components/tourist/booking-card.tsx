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
  ChevronDown,
  ChevronUp,
  Receipt,
  QrCode,
  Star,
  Loader2,
  ShieldAlert,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { estimateCancellationRefundAction, reportRefundIssueAction } from "@/app/actions/booking-actions";
import { getSignedReceiptUrl } from "@/lib/actions/get-receipt-url";
import { extractGcashRef } from "@/lib/ocr-scanner";

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
  commission_amount?: number;
  convenience_fee?: number;
  addons?: { name: string; price: number; commission: number }[];
  cancelled_by?: "tourist" | "host" | "admin" | null;
  cancelled_at?: string | null;
  cancellation_reason?: string | null;
  cancellation_policy?: string | null;
  refund_total?: number | null;
  deposit_refund_amount?: number | null;
  fee_refund_amount?: number | null;
  refund_gcash_number?: string | null;
  panaw_refund_status?: "none" | "pending" | "sent" | string | null;
  host_refund_status?: "none" | "pending" | "sent" | string | null;
  panaw_refund_receipt_url?: string | null;
  host_refund_receipt_url?: string | null;
  panaw_refund_amount?: number | null;
  host_refund_amount?: number | null;
  refund_issue_reported_at?: string | null;
  refund_issue_reason?: string | null;
  review?: { id: string; rating: number; comment?: string | null } | null;
}

export interface BookingCardProps {
  booking: BookingData;
  onCancelBooking?: (
    bookingId: string,
    details?: { reason: string; refundGcashNumber?: string }
  ) => Promise<void> | void;
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
  const [isExpanded, setIsExpanded] = React.useState(false);
  const [isCancelModalOpen, setIsCancelModalOpen] = React.useState(false);
  const [receiptModal, setReceiptModal] = React.useState<{
    open: boolean;
    title: string;
    receiptPath: string | null;
    amount?: number | null;
  }>({ open: false, title: "", receiptPath: null, amount: null });
  const [isReportIssueOpen, setIsReportIssueOpen] = React.useState(false);
  const [issueReportedText, setIssueReportedText] = React.useState<string | null>(
    booking.refund_issue_reason || null
  );
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

  const gcashRef = extractGcashRef(booking.receipt_url);

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
      onClick={() => setIsExpanded((prev) => !prev)}
      className={cn(
        "flex flex-col rounded-2xl border border-neutral-200 bg-white p-3.5 sm:p-4 shadow-2xs hover:border-neutral-300 transition-all cursor-pointer sm:cursor-default select-none sm:select-auto",
        className
      )}
    >
      {/* Header: Property & Status */}
      <div className="flex items-start justify-between gap-3 border-b border-neutral-100 pb-2.5 sm:pb-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-sm sm:text-base text-neutral-900 truncate">
              {booking.property_name}
            </h3>
            {booking.property_type && (
              <Badge variant="subtle" size="sm" className="capitalize text-[10px] px-1.5 py-0">
                {booking.property_type}
              </Badge>
            )}
          </div>
          <p className="text-xs font-medium text-neutral-600 mt-0.5 truncate">
            {booking.room_name}
          </p>
          {gcashRef && (
            <div
              className={cn(
                "inline-flex items-center gap-1.5 text-xs bg-blue-50 border border-blue-200 text-blue-900 px-2.5 py-1 rounded-lg mt-2",
                isExpanded ? "inline-flex" : "hidden sm:inline-flex"
              )}
            >
              <Receipt className="h-3.5 w-3.5 text-blue-600 shrink-0" />
              <span className="font-medium text-blue-700">GCash Ref:</span>
              <span className="font-mono font-bold tracking-tight">#{gcashRef}</span>
              {booking.payment_status === "deposit_uploaded" && (
                <span className="text-[10px] bg-blue-100 text-blue-700 font-medium px-1.5 py-0.5 rounded ml-1">
                  Verifying
                </span>
              )}
              {booking.payment_status === "verified" && (
                <span className="text-[10px] bg-emerald-100 text-emerald-700 font-medium px-1.5 py-0.5 rounded ml-1">
                  Verified
                </span>
              )}
            </div>
          )}
        </div>

        <Badge variant={currentStatus.variant} size="sm" className="shrink-0 gap-1 text-xs">
          <StatusIcon className="h-3 w-3" />
          <span>{currentStatus.label}</span>
        </Badge>
      </div>

      {/* Mobile Compact Overview (Dates & Total) - visible only on mobile when collapsed */}
      <div className={cn("flex sm:hidden items-center justify-between py-2.5 text-xs", isExpanded && "hidden")}>
        <div className="flex items-center gap-1.5 text-neutral-700 min-w-0">
          <Calendar className="h-3.5 w-3.5 text-neutral-400 shrink-0" />
          <span className="font-medium truncate">
            {formatDate(checkIn)} – {formatDate(checkOut)}
          </span>
          <span className="text-[11px] text-neutral-500 shrink-0">
            ({diffDays}n)
          </span>
        </div>
        <div className="text-right shrink-0 pl-2">
          <span className="font-bold text-sm text-neutral-900">
            {formattedTotal}
          </span>
        </div>
      </div>

      {/* Booking Details Grid - always visible on desktop, on mobile only when expanded */}
      <div
        className={cn(
          "grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-3 py-2.5 sm:py-3 text-xs",
          isExpanded ? "grid" : "hidden sm:grid"
        )}
      >
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

      {/* Itemized Breakdown Section - always visible on desktop, on mobile only when expanded */}
      <div
        onClick={(e) => e.stopPropagation()}
        className={cn(
          "bg-neutral-50/50 border-t border-b border-neutral-100 px-3.5 sm:px-4 py-2.5 sm:py-3 text-xs mt-1 mb-1.5 rounded-xl sm:rounded-none",
          isExpanded ? "block" : "hidden sm:block"
        )}
      >
        <h4 className="font-semibold text-neutral-800 mb-2 flex items-center gap-1.5">
          <Receipt className="h-3.5 w-3.5 text-neutral-500" />
          Price Breakdown
        </h4>
        <div className="space-y-1.5">
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

          <div className="border-t border-neutral-200/60 my-1.5"></div>
          
          {/* Guest Fee */}
          <div className="flex justify-between items-center text-neutral-600">
            <span>Booking Service Fee</span>
            <span>₱{booking.convenience_fee?.toLocaleString() || 100}</span>
          </div>

          <div className="border-t border-neutral-200/60 my-1.5"></div>

          {/* Final Total */}
          <div className="flex justify-between items-center font-bold text-neutral-900 text-sm">
            <span>Total Value</span>
            <span>₱{booking.total_price.toLocaleString()}</span>
          </div>
          
          <div className="border-t border-neutral-200/60 my-1.5"></div>
          
          {/* Downpayment reminder */}
          {booking.downpayment_amount && (
            <>
              <div className="flex justify-between items-center text-emerald-700 font-bold mt-1">
                <span>Total Due Now (Deposit + Fee)</span>
                <span>₱{booking.downpayment_amount.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center text-neutral-800 font-bold mt-1">
                <span>Remaining Balance (due at check-in)</span>
                <span>₱{(booking.total_price - booking.downpayment_amount).toLocaleString()}</span>
              </div>
            </>
          )}

          {/* Cancelled Booking & Refund Summary */}
          {booking.status === "cancelled" && (
            <div className="rounded-xl border border-red-200/80 bg-red-50/70 p-3.5 text-xs text-neutral-800 space-y-2 mt-3">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-red-900 flex items-center gap-1.5">
                  <AlertCircle className="h-4 w-4 text-red-600" />
                  Booking Cancelled
                </span>
                <Badge variant="outline" className="text-[10px] bg-white border-red-200 text-red-800 capitalize font-medium">
                  By {booking.cancelled_by === "tourist" ? "Guest" : booking.cancelled_by === "host" ? "Host" : (booking.cancelled_by || "Guest")}
                </Badge>
              </div>

              {booking.cancellation_reason && (
                <p className="text-neutral-700 italic bg-white/70 p-2 rounded-lg border border-red-100">
                  &ldquo;{booking.cancellation_reason}&rdquo;
                </p>
              )}

              {(booking.refund_total != null && booking.refund_total > 0) ? (
                <div className="pt-2 border-t border-red-200/60 space-y-2">
                  <div className="flex justify-between font-bold text-neutral-900">
                    <span>Scheduled Refund Total:</span>
                    <span className="text-emerald-700">₱{booking.refund_total.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-[11px] text-neutral-600">
                    <span>Deposit refund: ₱{(booking.deposit_refund_amount || 0).toLocaleString()} • Fee refund: ₱{(booking.fee_refund_amount || 0).toLocaleString()}</span>
                  </div>
                  {booking.refund_gcash_number && (
                    <div className="flex justify-between text-[11px] text-neutral-600">
                      <span>GCash Destination:</span>
                      <span className="font-mono font-medium text-neutral-800">{booking.refund_gcash_number}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center text-[11px] text-neutral-600 pt-1">
                    <span>Panaw Platform Leg:</span>
                    <div className="flex items-center gap-2">
                      <span className={cn("font-medium", booking.panaw_refund_status === "sent" ? "text-emerald-700 font-semibold" : "text-amber-700 font-medium")}>
                        {booking.panaw_refund_status === "sent" ? "Disbursed" : "Processing"}
                      </span>
                      {booking.panaw_refund_receipt_url && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-6 px-2 text-[10px] bg-white border-neutral-300 hover:bg-neutral-50"
                          onClick={() => {
                            setReceiptModal({
                              open: true,
                              title: "Panaw Refund Receipt",
                              receiptPath: booking.panaw_refund_receipt_url!,
                              amount: booking.panaw_refund_amount,
                            });
                          }}
                        >
                          <Receipt className="h-3 w-3 mr-1 text-emerald-600" />
                          View Receipt
                        </Button>
                      )}
                    </div>
                  </div>
                  {booking.host_refund_status && booking.host_refund_status !== "none" && (
                    <div className="flex justify-between items-center text-[11px] text-neutral-600">
                      <span>Host Refund Leg:</span>
                      <div className="flex items-center gap-2">
                        <span className={cn("font-medium", booking.host_refund_status === "sent" ? "text-emerald-700 font-semibold" : "text-amber-700 font-medium")}>
                          {booking.host_refund_status === "sent" ? "Disbursed" : "Pending host return"}
                        </span>
                        {booking.host_refund_receipt_url && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-6 px-2 text-[10px] bg-white border-neutral-300 hover:bg-neutral-50"
                            onClick={() => {
                              setReceiptModal({
                                open: true,
                                title: "Host Refund Receipt",
                                receiptPath: booking.host_refund_receipt_url!,
                                amount: booking.host_refund_amount,
                              });
                            }}
                          >
                            <Receipt className="h-3 w-3 mr-1 text-emerald-600" />
                            View Receipt
                          </Button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Issue reporting / feedback status */}
                  {issueReportedText ? (
                    <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded-lg text-[11px] text-amber-900 flex items-start gap-1.5">
                      <AlertCircle className="h-3.5 w-3.5 text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-semibold">Issue Reported:</span> &ldquo;{issueReportedText}&rdquo;
                        <p className="text-[10px] text-amber-700 mt-0.5">Panaw admin support has been notified and is investigating.</p>
                      </div>
                    </div>
                  ) : (
                    <div className="pt-1 flex justify-end">
                      <button
                        type="button"
                        onClick={() => setIsReportIssueOpen(true)}
                        className="text-[11px] text-red-700 hover:text-red-900 underline font-medium"
                      >
                        Report an issue with this refund
                      </button>
                    </div>
                  )}
                </div>
              ) : (booking.payment_status === "verified" || booking.payment_status === "completed") ? (
                <div className="pt-1 text-[11px] text-neutral-600">
                  Deposit is non-refundable according to the property&apos;s cancellation policy.
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>

      {/* Actions footer - always on desktop, on mobile only when expanded */}
      <div
        onClick={(e) => e.stopPropagation()}
        className={cn(
          "pt-2.5 sm:pt-3 border-t border-neutral-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3",
          isExpanded ? "flex" : "hidden sm:flex"
        )}
      >
        <p className="text-[11px] text-neutral-500">
          Booking ID: #{booking.id.slice(0, 8)}
        </p>

        <div className="flex flex-wrap items-center gap-2">
          {(booking.status === "accepted" || booking.status === "completed") &&
            booking.payment_status !== "awaiting_deposit" &&
            booking.payment_status !== "deposit_uploaded" &&
            onViewBoardingPass && (
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
            <>
              <Button
                variant="outline"
                size="sm"
                className="text-xs h-8 px-3 border-neutral-200 text-red-600 hover:bg-red-50 hover:border-red-200"
                onClick={() => setIsCancelModalOpen(true)}
              >
                Cancel {booking.status === "accepted" ? "Booking" : "Request"}
              </Button>
              <TouristCancellationModal
                booking={booking}
                isOpen={isCancelModalOpen}
                onOpenChange={setIsCancelModalOpen}
                onConfirmCancel={async (bookingId, details) => {
                  if (onCancelBooking) {
                    await onCancelBooking(bookingId, details);
                  }
                }}
              />
            </>
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
              {gcashRef ? `Payment (Ref: #${gcashRef.slice(-6)})` : "View Payment"}
            </Button>
          )}

          {booking.review ? (
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-xs font-semibold">
              <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-500" />
              <span>Rated {booking.review.rating}/5</span>
            </div>
          ) : (
            (() => {
              const isCheckoutPassed = new Date(booking.check_out_date) <= new Date();
              const canReview =
                booking.status !== "cancelled" &&
                (booking.status === "completed" ||
                  (booking.status === "accepted" &&
                    booking.payment_status === "verified" &&
                    isCheckoutPassed));

              if (canReview && onRateStay) {
                return (
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs h-8 px-3 border-amber-300 bg-amber-50/80 text-amber-900 hover:bg-amber-100 font-semibold shadow-2xs transition-all"
                    onClick={() => onRateStay(booking)}
                  >
                    <Star className="h-3.5 w-3.5 mr-1 fill-amber-400 text-amber-500" />
                    Rate Stay
                  </Button>
                );
              }
              return null;
            })()
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

      {/* Mobile Expand / Collapse Footer Bar */}
      <div className="flex sm:hidden items-center justify-between pt-2.5 mt-1 border-t border-neutral-100 text-[11px] font-semibold text-neutral-500">
        <span className="flex items-center gap-1 text-neutral-700">
          {isExpanded ? "Hide breakdown & actions" : "Tap to view breakdown & actions"}
          {isExpanded ? (
            <ChevronUp className="h-3.5 w-3.5 text-neutral-500" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5 text-neutral-500" />
          )}
        </span>
        <span className="text-[10px] text-neutral-400 font-mono font-normal">
          #{booking.id.slice(0, 8)}
        </span>
      </div>

      {/* Refund Receipt Viewer Modal */}
      <TouristRefundReceiptModal
        isOpen={receiptModal.open}
        onOpenChange={(open) => setReceiptModal((prev) => ({ ...prev, open }))}
        title={receiptModal.title}
        receiptPath={receiptModal.receiptPath}
        amount={receiptModal.amount}
      />

      {/* Report Refund Problem Modal */}
      <TouristReportIssueModal
        bookingId={booking.id}
        isOpen={isReportIssueOpen}
        onOpenChange={setIsReportIssueOpen}
        onSuccess={(reportedReason) => setIssueReportedText(reportedReason)}
      />
    </div>
  );
}

interface TouristCancellationModalProps {
  booking: BookingData;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirmCancel: (
    bookingId: string,
    details: { reason: string; refundGcashNumber?: string }
  ) => Promise<void>;
}

function TouristCancellationModal({
  booking,
  isOpen,
  onOpenChange,
  onConfirmCancel,
}: TouristCancellationModalProps) {
  const [isLoadingEstimate, setIsLoadingEstimate] = React.useState(false);
  const [estimate, setEstimate] = React.useState<{
    tier: string;
    deposit_refund: number;
    fee_refund: number;
    refund_total: number;
    days_before: number;
    reason: string;
  } | null>(null);
  const [estimateError, setEstimateError] = React.useState<string | null>(null);
  const [selectedReason, setSelectedReason] = React.useState("Change of travel plans");
  const [customReason, setCustomReason] = React.useState("");
  const [gcashNumber, setGcashNumber] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (isOpen) {
      if (booking.payment_status === "deposit_uploaded") {
        setEstimateError(
          "Your GCash deposit receipt is currently undergoing verification by our admin team. Direct cancellation is locked until verification is resolved. Please contact support if you need immediate assistance."
        );
        return;
      }

      setIsLoadingEstimate(true);
      setEstimateError(null);
      estimateCancellationRefundAction(booking.id)
        .then((res) => {
          if (res.success && res.data) {
            setEstimate(res.data);
          } else {
            setEstimateError(res.error || "Unable to retrieve cancellation refund estimate.");
          }
        })
        .catch((err) => {
          setEstimateError(err.message || "Failed to load cancellation preview.");
        })
        .finally(() => {
          setIsLoadingEstimate(false);
        });
    } else {
      setEstimate(null);
      setEstimateError(null);
      setCustomReason("");
      setGcashNumber("");
      setIsSubmitting(false);
    }
  }, [isOpen, booking.id, booking.payment_status]);

  const sanitizedGcash = gcashNumber.replace(/[\s-]/g, "");
  const requiresGcash = (estimate?.refund_total || 0) > 0;
  const isGcashValid = !requiresGcash || /^09\d{9}$/.test(sanitizedGcash);

  const handleSubmit = async () => {
    if (requiresGcash && !isGcashValid) {
      toast.error("Please enter a valid 11-digit GCash mobile number (09XXXXXXXXX).");
      return;
    }

    const finalReason =
      selectedReason === "Other"
        ? customReason.trim() || "Other reason"
        : selectedReason;

    try {
      setIsSubmitting(true);
      await onConfirmCancel(booking.id, {
        reason: finalReason,
        refundGcashNumber: requiresGcash ? sanitizedGcash : undefined,
      });
      onOpenChange(false);
    } catch {
      // Error handled by parent
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-neutral-900">
            Cancel {booking.status === "accepted" ? "Booking" : "Request"}
          </DialogTitle>
          <DialogDescription className="text-xs text-neutral-500">
            {booking.property_name} • Check-in: {booking.check_in_date}
          </DialogDescription>
        </DialogHeader>

        {booking.payment_status === "deposit_uploaded" ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900 space-y-2">
            <div className="flex items-center gap-2 font-semibold">
              <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
              Deposit Verification In Progress
            </div>
            <p className="text-amber-800 leading-relaxed">
              Your GCash deposit receipt is currently being verified by an admin. Cancellation is paused during verification. Please contact Panaw support if you need immediate assistance.
            </p>
          </div>
        ) : isLoadingEstimate ? (
          <div className="py-8 flex flex-col items-center justify-center gap-2 text-neutral-500">
            <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
            <span className="text-xs">Calculating cancellation policy and refund eligibility...</span>
          </div>
        ) : (
          <div className="space-y-4 py-1 text-xs">
            {estimateError && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-red-800">
                {estimateError}
              </div>
            )}

            {estimate && (
              <div className="rounded-xl border border-neutral-200 bg-neutral-50/70 p-3.5 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-neutral-900">Policy Preview</span>
                  <Badge variant="outline" className="text-[10px] uppercase font-bold bg-white text-neutral-700">
                    {estimate.tier} refund tier
                  </Badge>
                </div>
                <p className="text-neutral-600 text-[11px] leading-relaxed">
                  {estimate.reason}
                </p>

                <div className="border-t border-neutral-200/80 pt-2 space-y-1.5">
                  <div className="flex justify-between text-neutral-600">
                    <span>Notice before check-in:</span>
                    <span className="font-medium text-neutral-900">{estimate.days_before} days</span>
                  </div>
                  {estimate.deposit_refund > 0 && (
                    <div className="flex justify-between text-neutral-600">
                      <span>Deposit refund:</span>
                      <span className="font-medium text-neutral-900">₱{estimate.deposit_refund.toLocaleString()}</span>
                    </div>
                  )}
                  {estimate.fee_refund > 0 && (
                    <div className="flex justify-between text-neutral-600">
                      <span>Convenience fee refund:</span>
                      <span className="font-medium text-neutral-900">₱{estimate.fee_refund.toLocaleString()}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm font-bold text-neutral-900 pt-1 border-t border-neutral-200/60">
                    <span>Total Refund Due:</span>
                    <span className={estimate.refund_total > 0 ? "text-emerald-700 font-extrabold" : "text-neutral-700"}>
                      ₱{estimate.refund_total.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {requiresGcash && (
              <div className="space-y-1.5">
                <label className="font-semibold text-neutral-900 block">
                  GCash Mobile Number for Refund <span className="text-red-500">*</span>
                </label>
                <Input
                  type="tel"
                  placeholder="09171234567"
                  value={gcashNumber}
                  maxLength={11}
                  onChange={(e) => setGcashNumber(e.target.value)}
                  className="font-mono text-sm"
                />
                <p className="text-[10px] text-neutral-500">
                  Required: 11-digit mobile number starting with 09 where your refund will be disbursed.
                </p>
                {gcashNumber && !isGcashValid && (
                  <p className="text-[10px] text-red-600 font-medium">
                    Please enter a valid Philippine mobile number (e.g. 09171234567).
                  </p>
                )}
              </div>
            )}

            <div className="space-y-1.5">
              <label className="font-semibold text-neutral-900 block">
                Reason for Cancellation
              </label>
              <select
                className="w-full rounded-md border border-neutral-300 bg-white p-2 text-xs text-neutral-800 focus:outline-none focus:ring-1 focus:ring-emerald-600"
                value={selectedReason}
                onChange={(e) => setSelectedReason(e.target.value)}
              >
                <option value="Change of travel plans">Change of travel plans</option>
                <option value="Found alternative accommodation">Found alternative accommodation</option>
                <option value="Personal / Medical emergency">Personal / Medical emergency</option>
                <option value="Transportation or weather concern">Transportation or weather concern</option>
                <option value="Other">Other</option>
              </select>
              {selectedReason === "Other" && (
                <Input
                  type="text"
                  placeholder="Please specify reason..."
                  value={customReason}
                  maxLength={200}
                  onChange={(e) => setCustomReason(e.target.value)}
                  className="text-xs mt-1.5"
                />
              )}
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Keep Reservation
          </Button>
          {booking.payment_status !== "deposit_uploaded" && (
            <Button
              variant="destructive"
              size="sm"
              onClick={handleSubmit}
              disabled={isSubmitting || isLoadingEstimate || (requiresGcash && !isGcashValid)}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  Processing...
                </>
              ) : (
                "Confirm Cancellation"
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface TouristRefundReceiptModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  receiptPath: string | null;
  amount?: number | null;
}

function TouristRefundReceiptModal({
  isOpen,
  onOpenChange,
  title,
  receiptPath,
  amount,
}: TouristRefundReceiptModalProps) {
  const [signedUrl, setSignedUrl] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (isOpen && receiptPath) {
      setLoading(true);
      getSignedReceiptUrl(receiptPath)
        .then((url) => {
          setSignedUrl(url || receiptPath);
        })
        .catch(() => {
          setSignedUrl(receiptPath);
        })
        .finally(() => {
          setLoading(false);
        });
    } else {
      setSignedUrl(null);
    }
  }, [isOpen, receiptPath]);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-0 overflow-hidden bg-white">
        <DialogHeader className="p-4 border-b border-neutral-100 bg-neutral-50/50">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-emerald-100 flex items-center justify-center">
              <Receipt className="h-4 w-4 text-emerald-700" />
            </div>
            <div>
              <DialogTitle className="text-sm font-bold text-neutral-900 leading-tight">
                {title}
              </DialogTitle>
              {amount != null && (
                <DialogDescription className="text-xs font-semibold text-emerald-700 mt-0.5">
                  Amount Disbursed: ₱{amount.toLocaleString()}
                </DialogDescription>
              )}
            </div>
          </div>
        </DialogHeader>

        <div className="p-4">
          <div className="relative aspect-[3/4] w-full rounded-xl overflow-hidden border border-neutral-200 bg-neutral-100 flex items-center justify-center">
            {loading ? (
              <div className="flex flex-col items-center gap-2 text-neutral-500">
                <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
                <span className="text-xs">Loading receipt image...</span>
              </div>
            ) : signedUrl ? (
              <img
                src={signedUrl}
                alt="Refund Receipt Proof"
                className="w-full h-full object-contain"
              />
            ) : (
              <p className="text-xs text-neutral-400">Unable to load receipt image.</p>
            )}
          </div>
        </div>

        <DialogFooter className="p-3 bg-neutral-50 border-t border-neutral-100">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="text-xs w-full"
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface TouristReportIssueModalProps {
  bookingId: string;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (reason: string) => void;
}

function TouristReportIssueModal({
  bookingId,
  isOpen,
  onOpenChange,
  onSuccess,
}: TouristReportIssueModalProps) {
  const [reason, setReason] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const handleSubmit = async () => {
    if (!reason.trim()) {
      toast.error("Please explain the issue with your refund.");
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await reportRefundIssueAction({
        bookingId,
        reason: reason.trim(),
      });
      if (!res.success) {
        throw new Error(res.error || "Failed to submit dispute.");
      }
      toast.success("Issue submitted. Our support team will investigate.");
      onOpenChange(false);
      if (onSuccess) onSuccess(reason.trim());
    } catch (err: any) {
      toast.error(err.message || "Failed to submit report.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-red-100 flex items-center justify-center">
              <ShieldAlert className="h-4 w-4 text-red-600" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-neutral-900 leading-tight">
                Report Refund Problem
              </DialogTitle>
              <DialogDescription className="text-xs text-neutral-500 mt-0.5">
                Did you not receive your refund or notice an incorrect amount?
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-3 py-2 text-xs">
          <p className="text-neutral-600 leading-relaxed">
            Please provide details below. Include your GCash reference if available. Our administration team will review the transaction logs and contact you.
          </p>
          <textarea
            className="w-full rounded-xl border border-neutral-300 p-3 text-xs text-neutral-800 placeholder:text-neutral-400 focus:outline-none focus:ring-1 focus:ring-black min-h-[100px]"
            placeholder="e.g. The GCash account has not received the transfer, or the amount received does not match the refund computation..."
            value={reason}
            maxLength={500}
            onChange={(e) => setReason(e.target.value)}
          />
          <div className="flex justify-between text-[10px] text-neutral-400">
            <span>Maximum 500 characters</span>
            <span>{reason.length}/500</span>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={handleSubmit}
            disabled={isSubmitting || !reason.trim()}
            className="bg-red-600 hover:bg-red-700 text-white"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                Submitting...
              </>
            ) : (
              "Submit Issue Report"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
