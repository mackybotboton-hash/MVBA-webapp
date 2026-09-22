"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Compass,
  MapPin,
  Ship,
  Waves,
  Sun,
  Camera,
  ChevronRight,
  ShieldCheck,
  Star,
  Info,
} from "lucide-react";
import { Logo } from "@/components/shared/logo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import { WeatherAlertBanner } from "@/components/shared/weather-alert-banner";
import { createClient } from "@/lib/supabase/client";
import { useQuery } from "@tanstack/react-query";

interface IslandAttraction {
  name: string;
  tagline: string;
  description: string;
  features: string[];
  imageUrl: string;
}

const BRETANIA_ISLANDS: IslandAttraction[] = [
  {
    name: "Boslon Island",
    tagline: "The Iconic Sentinel of Bretania",
    description:
      "The largest of the 24 islets, featuring imposing limestone rock formations, towering coconut palms, and a statue of the Virgin Mary facing the sea. At low tide, a natural sandbar connects Boslon to neighboring islets.",
    features: ["Limestone Clifftops", "Shaded Rest Cottages", "Tide Sandbar"],
    imageUrl:
      "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=800&q=80",
  },
  {
    name: "Naked Island",
    tagline: "Pristine Pure White Sandbar",
    description:
      "A completely bare, gleaming white sandbar surrounded by 360-degree crystal clear turquoise waters. Named 'Naked' because it has no trees or foliage—just sun, sand, and ocean horizon.",
    features: ["Crystal Clear Water", "Sandbar Strolls", "Drone Photography"],
    imageUrl:
      "https://images.unsplash.com/photo-1519046904884-53103b34b206?auto=format&fit=crop&w=800&q=80",
  },
  {
    name: "Hagonoy Island",
    tagline: "The Postcard Paradise",
    description:
      "Half sandbar and half tropical coconut grove. It is famous for its pearly white beach and peaceful seaside atmosphere, making it a favorite spot for midday beach picnics and swimming.",
    features: ["Coconut Palm Groves", "Fine Powder Sand", "Swimming Lagoon"],
    imageUrl:
      "https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?auto=format&fit=crop&w=800&q=80",
  },
];

export default function TouristExplorePage() {
  const [activeIsland, setActiveIsland] = React.useState<string>(BRETANIA_ISLANDS[0].name);

  const { data: islands = BRETANIA_ISLANDS, isLoading } = useQuery({
    queryKey: ["explore-islands"],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("explore_islands")
        .select("*")
        .eq("is_active", true)
        .order("display_order", { ascending: true });

      if (data && data.length > 0) {
        return data.map((d: any) => ({
          name: d.name,
          tagline: d.tagline,
          description: d.description,
          features: d.features,
          imageUrl: d.image_url,
        }));
      }
      return BRETANIA_ISLANDS;
    }
  });

  // Ensure active island is valid when islands load
  React.useEffect(() => {
    if (islands && islands.length > 0 && !islands.find(i => i.name === activeIsland)) {
      setActiveIsland(islands[0].name);
    }
  }, [islands, activeIsland]);

  const selectedIsland =
    islands.find((i) => i.name === activeIsland) ||
    islands[0];

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="sticky top-0 z-40 w-full border-b border-neutral-200 bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-4">
            <Logo size="small" />
            <span className="text-sm font-semibold uppercase tracking-wider text-neutral-500">
              Explorer Guide
            </span>
          </div>

          <div className="flex items-center gap-3">
            <Link href="/">
              <Button
                variant="outline"
                size="sm"
                className="text-sm h-8 px-3 border-neutral-200"
              >
                Book Stays
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 sm:px-6 py-8 space-y-8">
        {/* Active Coast Guard Weather Alert */}
        <WeatherAlertBanner />

        {/* Hero Section */}
        <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-6 sm:p-10 relative overflow-hidden">
          <div className="max-w-2xl space-y-4">
            <div className="flex items-center gap-2">
              <Badge variant="default" size="sm">
                Surigao del Sur
              </Badge>
              <span className="text-sm text-neutral-600 font-medium flex items-center gap-1">
                <MapPin className="h-4 w-4" />
                San Agustin
              </span>
            </div>

            <h1 className="text-2xl sm:text-4xl font-bold text-neutral-900 tracking-tight">
              Explore the 24 Islands of Bretania
            </h1>

            <p className="text-base sm:text-lg text-neutral-600 leading-relaxed">
              Bretania is a secluded archipelago of 24 islands and islets scattered across Lianga Bay. From sandbars that submerge at high tide to dramatic limestone cliffs, here is your official visitor guide curated by MVBA.
            </p>


            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Link href="/">
                <Button className="bg-black text-white hover:bg-neutral-800 text-sm h-10 px-5">
                  Find Accommodations Nearby
                </Button>
              </Link>
              <div className="text-sm text-neutral-600 flex items-center gap-1">
                <ShieldCheck className="h-4 w-4 text-emerald-600" />
                <span>Association Accredited Boatmen</span>
              </div>
            </div>
          </div>
        </div>

        {/* Interactive Island Showcase */}
        <section className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 border-b border-neutral-200 pb-4">
            <div>
              <h2 className="text-xl font-bold text-neutral-900 tracking-tight">
                Top Islands on the Tourist Circuit
              </h2>
              <p className="text-sm text-neutral-600 mt-1">
                Click an island to view highlights, photography points, and tips
              </p>
            </div>

            {/* Island Tabs */}
            <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide py-1">
              {islands.map((island) => (
                <button
                  key={island.name}
                  onClick={() => setActiveIsland(island.name)}
                  className={`px-3.5 py-1.5 rounded-full text-sm font-medium transition-all shrink-0 ${
                    activeIsland === island.name
                      ? "bg-black text-white"
                      : "border border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300"
                  }`}
                >
                  {island.name}
                </button>
              ))}
            </div>
          </div>

          {/* Active Island Card Details */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center rounded-2xl border border-neutral-200 bg-white p-6 sm:p-8">
            <div className="lg:col-span-6 relative aspect-[16/10] w-full rounded-xl overflow-hidden bg-neutral-100">
              <Image
                src={selectedIsland.imageUrl}
                alt={selectedIsland.name}
                fill
                sizes="(max-width: 1024px) 100vw, 50vw"
                className="object-cover"
              />
            </div>

            <div className="lg:col-span-6 space-y-4">
              <div>
                <span className="text-sm font-semibold text-neutral-500 uppercase tracking-widest">
                  Featured Island
                </span>
                <h3 className="text-2xl font-bold text-neutral-900 mt-1">
                  {selectedIsland.name}
                </h3>
                <p className="text-base font-medium text-neutral-600 mt-0.5">
                  {selectedIsland.tagline}
                </p>
              </div>

              <p className="text-sm sm:text-base text-neutral-600 leading-relaxed">
                {selectedIsland.description}
              </p>

              <div className="space-y-2 pt-2">
                <span className="text-sm font-semibold text-neutral-900">
                  Key Island Highlights:
                </span>
                <div className="flex flex-wrap gap-2">
                  {selectedIsland.features.map((f: any, idx: number) => (
                    <Badge
                      key={idx}
                      variant="subtle"
                      className="border-neutral-200 bg-neutral-50 text-neutral-800 text-sm py-1"
                    >
                      <Waves className="h-3 w-3 text-neutral-600 mr-1" />
                      {f}
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="pt-4 border-t border-neutral-100 flex items-center justify-between">
                <span className="text-sm text-neutral-500">
                  Boat Tour: ~15 mins from mainland Bretania
                </span>
                <Link href="/">
                  <Button size="sm" className="bg-black text-white hover:bg-neutral-800 text-sm">
                    Browse Nearby Stays
                    <ChevronRight className="h-3.5 w-3.5 ml-1" />
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Association Guidelines for Visitors */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-xl border border-neutral-200 p-5 space-y-2 bg-neutral-50/50">
            <Ship className="h-6 w-6 text-neutral-900" />
            <h4 className="font-semibold text-base text-neutral-900">
              Standardized Boat Rates
            </h4>
            <p className="text-sm text-neutral-600 leading-relaxed">
              Association-regulated island hopping boat rates ensure tourists never get overcharged. Rates include life vests and environmental fees.
            </p>
          </div>

          <div className="rounded-xl border border-neutral-200 p-5 space-y-2 bg-neutral-50/50">
            <Camera className="h-6 w-6 text-neutral-900" />
            <h4 className="font-semibold text-base text-neutral-900">
              Best Visiting Hours
            </h4>
            <p className="text-sm text-neutral-600 leading-relaxed">
              Island hopping is best between 6:00 AM to 11:00 AM when the sea is glassy calm and the tide reveals sandbars across Naked & Boslon islands.
            </p>
          </div>

          <div className="rounded-xl border border-neutral-200 p-5 space-y-2 bg-neutral-50/50">
            <Info className="h-6 w-6 text-neutral-900" />
            <h4 className="font-semibold text-base text-neutral-900">
              Responsible Eco-Tourism
            </h4>
            <p className="text-sm text-neutral-600 leading-relaxed">
              San Agustin practices Clean-as-You-Go (CLAYGO). Please bring your trash back to mainland waste disposal points. Single-use plastics are discouraged.
            </p>
          </div>
        </section>

        {/* CTA to main listing */}
        <section className="space-y-4 pt-4">
          <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-neutral-900">Find Your Stay Near Bretania Port</h2>
              <p className="text-sm text-neutral-600 mt-1">Browse all accredited homestays and resorts available for booking.</p>
            </div>
            <Link
              href="/"
              className="shrink-0 inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-black text-white text-sm font-semibold hover:bg-neutral-800 transition-colors"
            >
              Browse All Stays
              <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
