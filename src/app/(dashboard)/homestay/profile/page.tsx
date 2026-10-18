import { PropertyProfileForm } from "@/components/owner/property-profile-form";

export default function HomestayProfilePage() {
  return (
    <div className="space-y-4 sm:space-y-5">
      <div className="border-b border-neutral-200 pb-3.5 sm:pb-4">
        <h1 className="text-xl sm:text-2xl font-bold text-neutral-900 tracking-tight">Overview & Policies</h1>
        <p className="text-xs sm:text-sm text-neutral-600 mt-0.5">
          Manage how your homestay appears to tourists and set your house rules.
        </p>
      </div>

      <PropertyProfileForm propertyType="homestay" />
    </div>
  );
}
