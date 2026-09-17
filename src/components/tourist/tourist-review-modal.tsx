"use client";

import * as React from "react";
import { toast } from "sonner";
import { Star, X, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

interface TouristReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  booking: any;
  onSuccess?: () => void;
}

export function TouristReviewModal({ isOpen, onClose, booking, onSuccess }: TouristReviewModalProps) {
  const [rating, setRating] = React.useState(5);
  const [hoverRating, setHoverRating] = React.useState(0);
  const [comment, setComment] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Reset state when opened
  React.useEffect(() => {
    if (isOpen) {
      setRating(5);
      setHoverRating(0);
      setComment("");
    }
  }, [isOpen]);

  if (!isOpen || !booking) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await (supabase.from("reviews") as any).insert({
        booking_id: booking.id,
        property_id: booking.property_id,
        tourist_id: user.id,
        rating,
        comment: comment.trim() || null,
        status: "published",
      });

      if (error) {
        // If unique constraint violated, they already reviewed
        if (error.code === "23505") {
          throw new Error("You have already submitted a review for this booking.");
        }
        throw error;
      }

      toast.success("Review submitted!", {
        description: "Thank you for sharing your experience.",
      });
      
      onSuccess?.();
      onClose();
    } catch (err: any) {
      toast.error("Failed to submit review", {
        description: err.message || "An unexpected error occurred.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity" onClick={onClose} />
      
      <div className="relative w-full max-w-md rounded-2xl bg-white border border-neutral-200 shadow-2xl p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
          <div>
            <h3 className="font-bold text-base text-neutral-900">Rate Your Stay</h3>
            <p className="text-xs text-neutral-500 font-medium">{booking.property_name}</p>
          </div>
          <button onClick={onClose} className="p-1 rounded-full text-neutral-500 hover:bg-neutral-100">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="flex flex-col items-center justify-center space-y-3 py-4">
            <p className="text-sm font-semibold text-neutral-800">How was your experience?</p>
            <div className="flex items-center gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(0)}
                  onClick={() => setRating(star)}
                  className="p-1 focus:outline-none transition-transform hover:scale-110"
                >
                  <Star
                    className={`h-8 w-8 ${
                      star <= (hoverRating || rating)
                        ? "fill-amber-400 text-amber-400"
                        : "text-neutral-200 fill-neutral-50"
                    } transition-colors`}
                  />
                </button>
              ))}
            </div>
            <p className="text-xs text-neutral-500 font-medium">
              {rating === 1 && "Terrible"}
              {rating === 2 && "Poor"}
              {rating === 3 && "Average"}
              {rating === 4 && "Very Good"}
              {rating === 5 && "Excellent"}
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-neutral-800 uppercase tracking-wider">
              Share your thoughts (Optional)
            </label>
            <textarea
              rows={4}
              placeholder="What did you love? What could be improved?"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              className="w-full p-3 text-sm rounded-xl border border-neutral-200 bg-neutral-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-black/5"
            />
          </div>

          <div className="pt-2">
            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-black text-white hover:bg-neutral-800 font-semibold h-11 rounded-xl"
            >
              {isSubmitting ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Submitting...</>
              ) : (
                "Submit Review"
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
