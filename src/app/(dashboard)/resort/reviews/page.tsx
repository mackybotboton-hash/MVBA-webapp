import { PropertyReviewsManager } from "@/components/owner/property-reviews-manager";

export default function ResortReviewsPage() {
  return (
    <div className="space-y-6">
      <div className="border-b border-neutral-200 pb-5">
        <h1 className="text-2xl font-bold text-neutral-900 tracking-tight">Guest Reviews</h1>
        <p className="text-sm text-neutral-600 mt-1">
          Read verified feedback from tourists who have completed a stay at your resort.
        </p>
      </div>

      <PropertyReviewsManager propertyType="resort" />
    </div>
  );
}
