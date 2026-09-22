import { Metadata } from "next";
import Link from "next/link";
import {
  ArrowLeft,
  Anchor,
  AlertTriangle,
  LifeBuoy,
  Trees,
  Trash2,
  Ship,
  Sparkles,
} from "lucide-react";
import { PolicyNav } from "@/components/layouts/policy-nav";

export const metadata: Metadata = {
  title: "Eco-Tourism & Safety Policies | MVBA",
  description:
    "Official municipal eco-tourism regulations, maritime safety rules, and environmental protection guidelines for Bretania 24 Islands, San Agustin.",
};

export default function PoliciesHubPage() {
  return (
    <div className="min-h-screen bg-neutral-50/50">
      {/* Top Header */}
      <header className="sticky top-0 z-30 w-full border-b border-neutral-200 bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-4xl items-center justify-between px-4 sm:px-6">
          <Link
            href="/"
            className="flex items-center gap-2 text-xs font-semibold text-neutral-600 hover:text-black transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Discovery</span>
          </Link>
          <span className="text-xs font-bold uppercase tracking-wider text-neutral-500">
            Municipal Ordinances
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 sm:px-6 py-8 sm:py-12 space-y-8">
        {/* Page Header */}
        <div className="space-y-3">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 text-xs font-semibold border border-emerald-200">
            <Anchor className="h-3.5 w-3.5 text-emerald-600" />
            <span>Bretania 24 Islands Eco-Tourism Code</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-neutral-900 tracking-tight">
            Eco-Tourism & Safety Policies
          </h1>
          <p className="text-sm text-neutral-600">
            San Agustin Municipal Tourism Office & Maritime Police Regulations governing island excursions and sustainable tourism in Lianga Bay.
          </p>
        </div>

        {/* Policy Tab Navigation */}
        <PolicyNav />

        {/* Content Body */}
        <div className="rounded-3xl border border-neutral-200 bg-white p-6 sm:p-10 shadow-xs space-y-8 text-neutral-800 text-sm leading-relaxed">
          {/* Section 1: Maritime Safety */}
          <section className="space-y-4">
            <div className="flex items-center gap-2.5 text-base font-bold text-neutral-950">
              <LifeBuoy className="h-5 w-5 text-blue-600" />
              <h2>1. Maritime Safety and Passenger Manifests</h2>
            </div>
            <p>
              Under Philippine Coast Guard (PCG) and Municipal Maritime Council mandates, every tourist vessel departing the Bretania mainland port must strictly adhere to the following safety criteria:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 rounded-2xl bg-neutral-50 border border-neutral-200 space-y-1.5">
                <span className="font-bold text-xs text-neutral-900 uppercase tracking-wide block">
                  Mandatory Life Jackets
                </span>
                <p className="text-xs text-neutral-600">
                  Every passenger must wear an approved life vest before boarding and maintain it throughout the entire sea crossing between islands.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-neutral-50 border border-neutral-200 space-y-1.5">
                <span className="font-bold text-xs text-neutral-900 uppercase tracking-wide block">
                  Strict Vessel Capacity
                </span>
                <p className="text-xs text-neutral-600">
                  Motorized outrigger bancas must never exceed their registered passenger capacity as certified in their MARINA vessel franchise.
                </p>
              </div>
            </div>
          </section>

          {/* Section 2: Environmental Protection */}
          <section className="space-y-4">
            <div className="flex items-center gap-2.5 text-base font-bold text-neutral-950">
              <Trees className="h-5 w-5 text-emerald-600" />
              <h2>2. Environmental Stewardship & Marine Conservation</h2>
            </div>
            <p>
              The 24 islands of Bretania are recognized as vital biodiversity sanctuaries. To protect this fragile marine ecosystem, visitors and operators are bound by municipal environmental ordinances:
            </p>
            <div className="rounded-2xl border border-neutral-200 divide-y divide-neutral-100 bg-neutral-50/50">
              <div className="p-4 flex items-start gap-3">
                <Trash2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-bold text-xs text-neutral-900 uppercase tracking-wide">
                    Clean As You Go (CLAYGO) & Zero Plastic Waste
                  </h3>
                  <p className="text-xs text-neutral-600 mt-0.5">
                    Single-use plastic bags and styrofoam containers are strictly prohibited on all island tours. All trash generated must be brought back to the mainland for municipal sorting.
                  </p>
                </div>
              </div>

              <div className="p-4 flex items-start gap-3">
                <Sparkles className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-bold text-xs text-neutral-900 uppercase tracking-wide">
                    No Coral Touching or Sand/Shell Harvesting
                  </h3>
                  <p className="text-xs text-neutral-600 mt-0.5">
                    Stepping on live coral formations, anchoring boats in coral beds, and collecting white sand or marine organisms as souvenirs is unlawful and subject to municipal fines.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Section 3: Weather Protocol */}
          <section className="space-y-4">
            <div className="flex items-center gap-2.5 text-base font-bold text-neutral-950">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              <h2>3. Weather Advisories & Sea Gale Protocol</h2>
            </div>
            <p>
              Passenger safety supersedes all tour itineraries. In cases where the Philippine Atmospheric, Geophysical and Astronomical Services Administration (PAGASA) or the Philippine Coast Guard issues a Gale Warning or Tropical Cyclone Wind Signal:
            </p>
            <ul className="list-disc pl-5 space-y-2 text-neutral-700">
              <li>
                <strong>Immediate Dispatch Suspension:</strong> All boat departures from the Bretania mainland pier are immediately suspended until the Coast Guard officially lifts the sea advisory.
              </li>
              <li>
                <strong>Emergency Recall:</strong> Vessels currently at sea will be directed by radio dispatch to immediately return to the designated sheltered mainland cove.
              </li>
              <li>
                <strong>Rescheduling & Refunds:</strong> Any tour or accommodation booking interrupted or cancelled due to sea gale warnings is eligible for a full rescheduling or 100% refund without penalty.
              </li>
            </ul>
          </section>

          {/* Section 4: Regulated Tariffs */}
          <section className="space-y-3">
            <div className="flex items-center gap-2.5 text-base font-bold text-neutral-950">
              <Ship className="h-5 w-5 text-indigo-600" />
              <h2>4. Regulated Boat Tariffs and Island Hopping Circuits</h2>
            </div>
            <p>
              All motorized boat rates are regulated by the Municipal Government of San Agustin and the MVBA Association. No operator may charge rates in excess of the official municipal matrix for the Standard 4-Island Circuit (Boslon Island, Hagonoy Island, Naked Island, and Busay Falls / Ironwood Sanctuary).
            </p>
          </section>

          <section className="space-y-3 pt-4 border-t border-neutral-200">
            <h2 className="text-base font-bold text-neutral-950">Report Violations</h2>
            <p className="text-neutral-600">
              To report maritime violations, excessive tariffs, or environmental abuse, contact the Municipal Tourism Hotline or approach the Tourism Information Desk at the Bretania Pier.
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}
