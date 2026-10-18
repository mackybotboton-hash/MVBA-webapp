import { BoatDispatchManager } from "@/components/owner/boat-dispatch-manager";

export default function ResortDispatchPage() {
  return (
    <div className="space-y-4 sm:space-y-5">
      <div className="border-b border-neutral-200 pb-3.5 sm:pb-4">
        <h1 className="text-xl sm:text-2xl font-bold text-neutral-900 tracking-tight">Boat Dispatch Management</h1>
        <p className="text-xs sm:text-sm text-neutral-600 mt-0.5">
          Manage your daily boat dispatches, whether using your own boats or hiring from the Boat Association.
        </p>
      </div>

      <BoatDispatchManager propertyType="resort" />
    </div>
  );
}
