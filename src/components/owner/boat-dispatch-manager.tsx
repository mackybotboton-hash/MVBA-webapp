"use client";

import * as React from "react";
import { toast } from "sonner";
import { BoatRateCalculator } from "@/components/owner/boat-rate-calculator";
import { Badge } from "@/components/ui/badge";

export function BoatDispatchManager({ propertyType }: { propertyType: "homestay" | "resort" }) {
  // This would typically fetch from the `boat_dispatches` table
  // For now, we mock it based on the previous UI you had

  return (
    <div className="space-y-6">
      {/* Standardized Boat Rate Calculator */}
      <BoatRateCalculator />

      {/* Active Boat Dispatches & Captain Manifests */}
      <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-neutral-100 pb-3 gap-2">
          <div>
            <h3 className="font-bold text-base text-neutral-900">
              Today&apos;s Island Hopping Boat Dispatches
            </h3>
            <p className="text-xs text-neutral-600">
              Coast Guard verified vessels, assigned captains, and passenger manifests
            </p>
          </div>

          <span className="text-xs font-bold text-neutral-600 bg-neutral-100 px-3 py-1 rounded-lg w-fit">
            Port: Bretania Mainland Pier
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
          {[
            {
              id: "voyage-1",
              vessel: "MB Bretania Star",
              regNo: "PCG-SUR-8419",
              captain: "Capt. Noel Martinez",
              pax: 8,
              destination: "4-Island Circuit (Boslon, Naked, Hagonoy)",
              status: "At Sea",
              statusVariant: "warning" as const,
              time: "Departed 09:30 AM",
              type: "Owned",
            },
            {
              id: "voyage-2",
              vessel: "MB Isla Paraiso",
              regNo: "PCG-SUR-9102",
              captain: "Capt. Allan Reyes",
              pax: 12,
              destination: "Boslon & Naked Island Sandbar",
              status: "Scheduled",
              statusVariant: "subtle" as const,
              time: "Boarding 11:00 AM",
              type: "Association Hired",
            },
            {
              id: "voyage-3",
              vessel: "MB Coral Queen",
              regNo: "PCG-SUR-4301",
              captain: "Capt. Danilo Vega",
              pax: 6,
              destination: "Hagonoy & Panlangagan Islet",
              status: "Returned to Port",
              statusVariant: "success" as const,
              time: "Arrived 08:45 AM",
              type: "Owned",
            },
          ].map((voyage) => (
            <div
              key={voyage.id}
              className="rounded-xl border border-neutral-200 p-4 space-y-3 bg-neutral-50/50"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h4 className="font-bold text-sm text-neutral-900">
                    {voyage.vessel}
                  </h4>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <p className="text-[11px] text-neutral-500 font-mono">
                      {voyage.regNo}
                    </p>
                    <span className="text-[10px] bg-neutral-200 text-neutral-600 px-1.5 rounded-sm">
                      {voyage.type}
                    </span>
                  </div>
                </div>

                <Badge variant={voyage.statusVariant} size="sm" dot>
                  {voyage.status}
                </Badge>
              </div>

              <div className="space-y-1 text-xs text-neutral-600">
                <p>
                  <strong>Captain:</strong> {voyage.captain}
                </p>
                <p>
                  <strong>Manifest:</strong> {voyage.pax} Guests (Life vests checked)
                </p>
                <p className="text-[11px] text-neutral-600 font-medium">
                  {voyage.destination}
                </p>
              </div>

              <div className="pt-2 border-t border-neutral-200 text-[11px] font-semibold text-neutral-600 flex justify-between items-center">
                <span>{voyage.time}</span>
                <button
                  type="button"
                  onClick={() => toast.success(`Updated status for ${voyage.vessel}`)}
                  className="text-neutral-800 hover:text-black hover:underline font-bold"
                >
                  Update Status &rarr;
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
