"use client";

import * as React from "react";
import { Star, MessageSquareQuote, Loader2, Building2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/tourist/empty-state";
import { format } from "date-fns";

export function PropertyReviewsManager({ propertyType }: { propertyType: "homestay" | "resort" }) {
  const formatGuestName = (fullName?: string) => {
    if (!fullName) return "Anonymous Guest";
    const parts = fullName.trim().split(" ");
    if (parts.length === 1) return parts[0];
    const firstName = parts[0];
    const lastNameInitial = parts[parts.length - 1].charAt(0).toUpperCase();
    return `${firstName} ${lastNameInitial}.`;
  };

  const [property, setProperty] = React.useState<any>(null);
  const [reviews, setReviews] = React.useState<any[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    async function fetchReviews() {
      setIsLoading(true);
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: propData } = await supabase
          .from("properties")
          .select("*")
          .eq("owner_id", user.id)
          .eq("type", propertyType)
          .limit(1)
          .single();

        if (propData) {
          setProperty(propData);
          
          // Fetch reviews with tourist details
          const { data: reviewsData } = await (supabase.from("reviews") as any)
            .select(`
              *,
              tourist:profiles (
                full_name,
                avatar_url
              )
            `)
            .eq("property_id", (propData as any).id)
            .order("created_at", { ascending: false });

          setReviews(reviewsData || []);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    }
    fetchReviews();
  }, [propertyType]);

  const averageRating = reviews.length > 0
    ? (reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length).toFixed(1)
    : 0;

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-neutral-400" />
      </div>
    );
  }

  if (!property) {
    return (
      <EmptyState
        icon={Building2}
        title={`Create a ${propertyType} listing first`}
        description="You need to set up your profile before you can receive reviews."
        actionLabel="View Dashboard"
        onAction={() => (window.location.href = `/${propertyType}`)}
      />
    );
  }

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Stats Header */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-neutral-200 p-6 flex flex-col justify-center items-center text-center shadow-sm">
          <div className="flex items-center gap-1 text-amber-500 mb-2">
            <Star className="h-6 w-6 fill-current" />
          </div>
          <h3 className="text-3xl font-bold text-neutral-900">{averageRating}</h3>
          <p className="text-xs text-neutral-500 font-medium uppercase tracking-wider mt-1">Average Rating</p>
        </div>
        <div className="bg-white rounded-2xl border border-neutral-200 p-6 flex flex-col justify-center items-center text-center shadow-sm">
          <div className="flex items-center gap-1 text-blue-500 mb-2">
            <MessageSquareQuote className="h-6 w-6" />
          </div>
          <h3 className="text-3xl font-bold text-neutral-900">{reviews.length}</h3>
          <p className="text-xs text-neutral-500 font-medium uppercase tracking-wider mt-1">Total Reviews</p>
        </div>
      </div>

      {/* Reviews List */}
      <div className="bg-white rounded-2xl border border-neutral-200 p-6 shadow-sm">
        <h2 className="text-lg font-bold text-neutral-900 mb-4">Guest Feedback</h2>
        
        {reviews.length === 0 ? (
          <div className="text-center py-12">
            <MessageSquareQuote className="h-10 w-10 text-neutral-300 mx-auto mb-3" />
            <p className="text-sm font-medium text-neutral-900">No reviews yet</p>
            <p className="text-xs text-neutral-500 mt-1">
              Once tourists complete a booking at your {propertyType}, they will be prompted to leave a review.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {reviews.map((review) => (
              <div key={review.id} className="p-4 rounded-xl border border-neutral-100 bg-neutral-50/50 flex gap-4">
                <div className="h-10 w-10 rounded-full bg-neutral-200 overflow-hidden flex-shrink-0">
                  {review.tourist?.avatar_url ? (
                    <img src={review.tourist.avatar_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center bg-black text-white text-sm font-bold">
                      {review.tourist?.full_name?.charAt(0) || "T"}
                    </div>
                  )}
                </div>
                <div className="flex-1 space-y-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-sm font-bold text-neutral-900">{formatGuestName(review.tourist?.full_name)}</p>
                      <p className="text-[11px] text-neutral-500">{format(new Date(review.created_at), "MMM d, yyyy")}</p>
                    </div>
                    <div className="flex text-amber-500">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star key={i} className={`h-4 w-4 ${i < review.rating ? "fill-current" : "text-neutral-200"}`} />
                      ))}
                    </div>
                  </div>
                  {review.comment && (
                    <p className="text-sm text-neutral-700 leading-relaxed bg-white p-3 rounded-lg border border-neutral-100">
                      &ldquo;{review.comment}&rdquo;
                    </p>
                  )}
                  {review.image_urls && review.image_urls.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-2">
                      {review.image_urls.map((url: string, i: number) => (
                        <div key={i} className="h-16 w-16 sm:h-20 sm:w-20 rounded-xl overflow-hidden border border-neutral-200">
                          <img src={url} alt={`Review photo ${i + 1}`} className="h-full w-full object-cover hover:scale-105 transition-transform cursor-pointer" />
                        </div>
                      ))}
                    </div>
                  )}
                  {review.status === "hidden" && (
                    <Badge variant="destructive" size="sm">Hidden by Admin</Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
