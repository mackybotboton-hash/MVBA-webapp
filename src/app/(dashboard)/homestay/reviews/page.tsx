import { PropertyReviewsManager } from "@/components/owner/property-reviews-manager";

export default function HomestayReviewsPage() {
  return (
    <div className="space-y-4 sm:space-y-5">
      <div className="border-b border-neutral-200 pb-3.5 sm:pb-4">
        <h1 className="text-xl sm:text-2xl font-bold text-neutral-900 tracking-tight">Guest Reviews</h1>
        <p className="text-xs sm:text-sm text-neutral-600 mt-0.5">
          Read verified feedback from tourists who have completed a stay at your homestay.
        </p>
      </div>

      <PropertyReviewsManager propertyType="homestay" />
    </div>
  );
}
