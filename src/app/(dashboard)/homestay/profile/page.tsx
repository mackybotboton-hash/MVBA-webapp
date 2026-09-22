import { PropertyProfileForm } from "@/components/owner/property-profile-form";

export default function HomestayProfilePage() {
  return (
    <div className="space-y-6">
      <div className="border-b border-neutral-200 pb-5">
        <h1 className="text-2xl font-bold text-neutral-900 tracking-tight">Overview & Policies</h1>
        <p className="text-sm text-neutral-600 mt-1">
          Manage how your homestay appears to tourists and set your house rules.
        </p>
      </div>

      <PropertyProfileForm propertyType="homestay" />
    </div>
  );
}
