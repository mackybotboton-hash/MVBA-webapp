"use client";

import * as React from "react";
import { toast } from "sonner";
import { Star, X, Loader2, Camera } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { uploadFile, generateFilePath } from "@/lib/supabase/storage";
import { STORAGE_BUCKETS } from "@/lib/constants";
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
  const [images, setImages] = React.useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      if (images.length + newFiles.length > 5) {
        toast.error("You can only upload up to 5 images.");
        return;
      }
      setImages((prev) => [...prev, ...newFiles]);
    }
  };

  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  // Reset state when opened
  React.useEffect(() => {
    if (isOpen) {
      setRating(5);
      setHoverRating(0);
      setComment("");
      setImages([]);
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

      let uploadedImageUrls: string[] = [];
      if (images.length > 0) {
        for (const file of images) {
          const path = generateFilePath("reviews", file.name);
          const url = await uploadFile(STORAGE_BUCKETS.PROPERTY_IMAGES, path, file);
          if (url) {
            uploadedImageUrls.push(url);
          }
        }
      }

      const { error } = await (supabase.from("reviews") as any).insert({
        booking_id: booking.id,
        property_id: booking.property_id,
        tourist_id: user.id,
        rating,
        comment: comment.trim() || null,
        status: "published",
        image_urls: uploadedImageUrls,
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

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-neutral-800 uppercase tracking-wider">
              Add Photos (Max 5)
            </label>
            <div className="flex flex-wrap gap-2">
              {images.map((img, i) => (
                <div key={i} className="relative h-16 w-16 rounded-xl border border-neutral-200 overflow-hidden group">
                  <img src={URL.createObjectURL(img)} alt="Preview" className="h-full w-full object-cover" />
                  <button type="button" onClick={() => removeImage(i)} className="absolute top-1 right-1 bg-black/50 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
              {images.length < 5 && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="h-16 w-16 rounded-xl border-2 border-dashed border-neutral-300 flex flex-col items-center justify-center text-neutral-500 hover:border-neutral-400 hover:text-neutral-700 transition-colors bg-neutral-50"
                >
                  <Camera className="h-5 w-5 mb-1" />
                  <span className="text-[10px] font-medium">Add</span>
                </button>
              )}
            </div>
            <input type="file" ref={fileInputRef} accept="image/*" multiple onChange={handleFileChange} className="hidden" />
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
