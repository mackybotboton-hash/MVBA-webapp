"use client";

import * as React from "react";
import Link from "next/link";
import {
  Building2,
  Home,
  MapPin,
  ExternalLink,
  ShieldCheck,
  RefreshCw,
  Search,
  MessageSquare,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/tourist/empty-state";

import { PropertyFormModal } from "@/components/owner/property-form-modal";

const statusFilters = [
  { label: "All Properties", value: "all" },
  { label: "Active", value: "active" },
  { label: "Renovating", value: "renovating" },
  { label: "Full", value: "full" },
  { label: "Closed", value: "closed" },
];

export default function AdminPropertiesPage() {
  const [properties, setProperties] = React.useState<any[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [editingProperty, setEditingProperty] = React.useState<any>(null);

  const fetchProperties = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("properties")
        .select(`
          *,
          profiles!owner_id(full_name, email, phone_number),
          rooms(id, name, base_price)
        `)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Failed to load properties:", error);
        setProperties([]);
      } else {
        setProperties(data || []);
      }
    } catch (err) {
      console.error("Unexpected error loading properties:", err);
      setProperties([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchProperties();
  }, [fetchProperties]);

  const filtered = properties.filter((p) => {
    const q = searchQuery.toLowerCase();
    const name = (p.name || "").toLowerCase();
    const address = (p.address || "").toLowerCase();
    const matchesSearch = !q || name.includes(q) || address.includes(q);
    const matchesStatus =
      statusFilter === "all" || (p.status || "active") === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900 tracking-tight">
            Properties Directory
          </h1>
          <p className="text-xs sm:text-sm text-neutral-600 mt-1 font-medium">
            Monitor accredited resorts, homestays, and compliance across San Agustin
          </p>
        </div>

        <button
          onClick={fetchProperties}
          disabled={isLoading}
          className="flex items-center gap-1.5 text-xs font-semibold text-neutral-700 hover:text-black self-start sm:self-auto"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Filter & Search Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-neutral-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by property or island..."
            className="w-full h-10 pl-9 pr-3 rounded-xl border border-neutral-300 text-xs font-medium text-neutral-900 placeholder:text-neutral-500 focus:outline-none focus:ring-1 focus:ring-black bg-white"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide py-1">
          {statusFilters.map((sf) => (
            <button
              key={sf.value}
              onClick={() => setStatusFilter(sf.value)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all border shrink-0 ${
                statusFilter === sf.value
                  ? "bg-black text-white border-black"
                  : "bg-white text-neutral-700 border-neutral-300 hover:border-neutral-400"
              }`}
            >
              {sf.label}
            </button>
          ))}
        </div>
      </div>

      {/* Property Cards Grid */}
      {!isLoading && filtered.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="No properties yet"
          description="No owners have registered a property yet. Once an owner registers and adds their property, it will appear here."
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((property) => (
            <div
              key={property.id}
              className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-xs flex flex-col justify-between gap-4 hover:border-neutral-300 transition-all"
            >
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <Badge
                    variant={property.type === "resort" ? "default" : "secondary"}
                    size="sm"
                    className="capitalize font-semibold"
                  >
                    {property.type}
                  </Badge>

                  <Badge variant="success" size="sm" dot>
                    Verified Member
                  </Badge>
                </div>

                <div>
                  <h3 className="font-bold text-base text-neutral-900">
                    {property.name}
                  </h3>
                  <p className="text-xs text-neutral-600 flex items-center gap-1 mt-1 font-medium">
                    <MapPin className="h-3 w-3 text-neutral-500" />
                    {property.address || "Bretania, San Agustin"}
                  </p>
                </div>

                {property.profiles && (
                  <div className="pt-2 border-t border-neutral-100 text-xs text-neutral-700">
                    <span className="text-neutral-500 block text-[10px] uppercase font-bold">
                      Registered Owner
                    </span>
                    <p className="font-semibold text-neutral-900 mt-0.5">
                      {property.profiles.full_name || property.profiles.email}
                    </p>
                    {property.profiles.phone_number && (
                      <p className="text-neutral-600 text-[11px]">
                        {property.profiles.phone_number}
                      </p>
                    )}
                  </div>
                )}
              </div>

              <div className="pt-3 border-t border-neutral-100 flex items-center justify-between">
                <span className="text-xs font-semibold text-neutral-600">
                  {(property.rooms || []).length} rooms configured
                </span>

                <div className="flex items-center gap-2">
                  {property.owner_id && (
                    <Link
                      href={`/admin/chat?recipient=${property.owner_id}`}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-neutral-300 text-[11px] font-bold text-neutral-800 hover:bg-neutral-100 transition-colors shadow-2xs"
                    >
                      <MessageSquare className="h-3 w-3 text-neutral-600" />
                      <span>Message Host</span>
                    </Link>
                  )}
                  <button
                    onClick={() => {
                      setEditingProperty(property);
                      setIsModalOpen(true);
                    }}
                    className="px-2.5 py-1 rounded-lg border border-neutral-300 text-[11px] font-bold text-neutral-800 hover:bg-neutral-100 transition-colors"
                  >
                    Edit Details
                  </button>
                  <Link
                    href={`/property/${property.id}`}
                    target="_blank"
                    className="inline-flex items-center gap-1 text-xs font-bold text-neutral-900 hover:text-black transition-colors"
                  >
                    <span>Storefront</span>
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Admin Property Edit Modal */}
      <PropertyFormModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingProperty(null);
        }}
        initialData={editingProperty}
        isAdmin={true}
        onSuccess={(updated) => {
          setProperties((prev) =>
            prev.map((p) => (p.id === updated.id ? { ...p, ...updated } : p))
          );
        }}
      />
    </div>
  );
}
