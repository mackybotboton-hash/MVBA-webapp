import { BoatDispatchManager } from "@/components/owner/boat-dispatch-manager";

export default function ResortDispatchPage() {
  return (
    <div className="space-y-6">
      <div className="border-b border-neutral-200 pb-5">
        <h1 className="text-2xl font-bold text-neutral-900 tracking-tight">Boat Dispatch Management</h1>
        <p className="text-sm text-neutral-600 mt-1">
          Manage your daily boat dispatches, whether using your own boats or hiring from the Boat Association.
        </p>
      </div>

      <BoatDispatchManager propertyType="resort" />
    </div>
  );
}
