"use client";

import * as React from "react";
import {
  Ship,
  Users,
  Check,
  Compass,
  LifeBuoy,
  Anchor,
  Phone,
  Plus,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export interface BoatRateCalculatorProps {
  onDispatchCreated?: (dispatchData: any) => void;
}

export function BoatRateCalculator({ onDispatchCreated }: BoatRateCalculatorProps) {
  const [passengerCount, setPassengerCount] = React.useState(6);
  const [includeSnorkelGear, setIncludeSnorkelGear] = React.useState(false);
  const [includeEnvironmentalFee, setIncludeEnvironmentalFee] = React.useState(true);
  const [includeLunchPack, setIncludeLunchPack] = React.useState(false);

  // Rate constants (MVBA Standard Bretania 4-Island Circuit)
  const BASE_PRICE = 1500; // Covers 1-8 pax
  const EXTRA_PERSON_RATE = 150; // Per pax beyond 8
  const SNORKEL_RATE = 150; // Per pax
  const ENVIRONMENTAL_FEE = 50; // Per pax
  const LUNCH_PACK_RATE = 350; // Per pax boodle fight

  // Calculation
  const extraPax = Math.max(0, passengerCount - 8);
  const boatTourSubtotal = BASE_PRICE + extraPax * EXTRA_PERSON_RATE;
  const snorkelTotal = includeSnorkelGear ? SNORKEL_RATE * passengerCount : 0;
  const envFeeTotal = includeEnvironmentalFee ? ENVIRONMENTAL_FEE * passengerCount : 0;
  const lunchTotal = includeLunchPack ? LUNCH_PACK_RATE * passengerCount : 0;
  const grandTotal = boatTourSubtotal + snorkelTotal + envFeeTotal + lunchTotal;

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-xs space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-neutral-100 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-black text-white">
              <Ship className="h-4 w-4" />
            </div>
            <h3 className="font-bold text-base text-neutral-900">
              MVBA Standardized Island Hopping Rate Calculator
            </h3>
          </div>
          <p className="text-xs text-neutral-600 mt-1">
            Standard tariff for the Bretania 4-Island Circuit (Naked, Boslon, Hagonoy, Panlangagan)
          </p>
        </div>

        <Badge variant="success" size="sm" dot>
          MVBA Regulated Tariff
        </Badge>
      </div>


      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Passenger Selection & Add-ons */}
        <div className="space-y-5">
          {/* Passenger Count */}
          <div className="space-y-2">
            <div className="flex justify-between items-center text-xs">
              <label className="font-bold text-neutral-900 uppercase tracking-wider text-[11px]">
                Number of Passengers (1 – 15 max)
              </label>
              <span className="font-bold text-neutral-900 bg-neutral-100 px-2.5 py-0.5 rounded-full">
                {passengerCount} Guests {passengerCount > 8 ? "(+Extra Pax)" : "(Standard Boat)"}
              </span>
            </div>

            <input
              type="range"
              min={1}
              max={15}
              value={passengerCount}
              onChange={(e) => setPassengerCount(Number(e.target.value))}
              className="w-full accent-black h-2 bg-neutral-100 rounded-lg cursor-pointer"
            />

            <div className="flex justify-between text-[10px] text-neutral-500 font-mono">
              <span>1 pax</span>
              <span>8 pax (Base Tier)</span>
              <span>15 pax (Max Coast Guard Limit)</span>
            </div>
          </div>

          {/* Add-ons Checkboxes */}
          <div className="space-y-2.5 pt-2 border-t border-neutral-100">
            <label className="font-bold text-neutral-900 uppercase tracking-wider text-[11px] block">
              Optional Add-on Packages
            </label>

            {/* Environmental Fee */}
            <label className="flex items-center justify-between p-3 rounded-xl border border-neutral-200 hover:bg-neutral-50 cursor-pointer transition-colors">
              <div className="flex items-center gap-2.5">
                <input
                  type="checkbox"
                  checked={includeEnvironmentalFee}
                  onChange={(e) => setIncludeEnvironmentalFee(e.target.checked)}
                  className="h-4 w-4 rounded border-neutral-300 text-black focus:ring-black"
                />
                <div>
                  <p className="font-bold text-xs text-neutral-900">
                    Municipal Ecological & Island Fee
                  </p>
                  <p className="text-[11px] text-neutral-600">
                    Required for entry to Boslon & Naked Island
                  </p>
                </div>
              </div>
              <span className="font-bold text-xs text-neutral-900">
                +₱{ENVIRONMENTAL_FEE}/pax
              </span>
            </label>

            {/* Snorkel Gear */}
            <label className="flex items-center justify-between p-3 rounded-xl border border-neutral-200 hover:bg-neutral-50 cursor-pointer transition-colors">
              <div className="flex items-center gap-2.5">
                <input
                  type="checkbox"
                  checked={includeSnorkelGear}
                  onChange={(e) => setIncludeSnorkelGear(e.target.checked)}
                  className="h-4 w-4 rounded border-neutral-300 text-black focus:ring-black"
                />
                <div>
                  <p className="font-bold text-xs text-neutral-900">
                    Snorkel Mask & Coral Reef Gear
                  </p>
                  <p className="text-[11px] text-neutral-600">
                    Disinfected silicone mask & snorkel per guest
                  </p>
                </div>
              </div>
              <span className="font-bold text-xs text-neutral-900">
                +₱{SNORKEL_RATE}/pax
              </span>
            </label>

            {/* Seafood Lunch */}
            <label className="flex items-center justify-between p-3 rounded-xl border border-neutral-200 hover:bg-neutral-50 cursor-pointer transition-colors">
              <div className="flex items-center gap-2.5">
                <input
                  type="checkbox"
                  checked={includeLunchPack}
                  onChange={(e) => setIncludeLunchPack(e.target.checked)}
                  className="h-4 w-4 rounded border-neutral-300 text-black focus:ring-black"
                />
                <div>
                  <p className="font-bold text-xs text-neutral-900">
                    Island Boodle Fight Lunch
                  </p>
                  <p className="text-[11px] text-neutral-600">
                    Grilled fish, Liempo, crabs, seaweed & fresh fruits
                  </p>
                </div>
              </div>
              <span className="font-bold text-xs text-neutral-900">
                +₱{LUNCH_PACK_RATE}/pax
              </span>
            </label>
          </div>
        </div>

        {/* Right: Tariff Summary & Cost Breakdown */}
        <div className="rounded-2xl bg-neutral-50 border border-neutral-200 p-5 flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <h4 className="font-bold text-xs text-neutral-900 uppercase tracking-wider">
              Itemized Quotation Breakdown
            </h4>

            <div className="space-y-2 text-xs divide-y divide-neutral-200">
              <div className="flex justify-between text-neutral-600 pt-1">
                <span>Standard 4-Island Boat (1–8 pax base):</span>
                <span className="font-semibold text-neutral-900">₱{BASE_PRICE.toLocaleString()}</span>
              </div>

              {extraPax > 0 && (
                <div className="flex justify-between text-neutral-600 pt-2">
                  <span>Additional passengers ({extraPax} × ₱150):</span>
                  <span className="font-semibold text-neutral-900">₱{(extraPax * EXTRA_PERSON_RATE).toLocaleString()}</span>
                </div>
              )}

              {includeEnvironmentalFee && (
                <div className="flex justify-between text-neutral-600 pt-2">
                  <span>Ecological fees ({passengerCount} pax × ₱50):</span>
                  <span className="font-semibold text-neutral-900">₱{envFeeTotal.toLocaleString()}</span>
                </div>
              )}

              {includeSnorkelGear && (
                <div className="flex justify-between text-neutral-600 pt-2">
                  <span>Snorkel gear rentals ({passengerCount} × ₱150):</span>
                  <span className="font-semibold text-neutral-900">₱{snorkelTotal.toLocaleString()}</span>
                </div>
              )}

              {includeLunchPack && (
                <div className="flex justify-between text-neutral-600 pt-2">
                  <span>Island catering ({passengerCount} × ₱350):</span>
                  <span className="font-semibold text-neutral-900">₱{lunchTotal.toLocaleString()}</span>
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-neutral-300 flex justify-between items-baseline">
              <div>
                <span className="font-bold text-sm text-neutral-900 block">Total Quotation</span>
                <span className="text-[10px] text-neutral-600">Includes DOT-approved life vests</span>
              </div>
              <span className="text-2xl font-bold text-neutral-900">
                ₱{grandTotal.toLocaleString()}
              </span>
            </div>
          </div>

          <div className="p-3 bg-white rounded-xl border border-neutral-200 text-[11px] text-neutral-600 space-y-1">
            <p className="font-bold text-neutral-900 flex items-center gap-1.5">
              <LifeBuoy className="h-3.5 w-3.5 text-neutral-700" />
              Safety Guarantee
            </p>
            <p>
              Includes DOT-certified boat captain, Coast Guard registered banca, first aid kit, and verified passenger manifests.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
