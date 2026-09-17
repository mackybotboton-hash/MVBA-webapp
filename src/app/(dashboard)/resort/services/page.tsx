"use client";

import * as React from "react";
import { toast } from "sonner";
import {
  Ship,
  UtensilsCrossed,
  MapPin,
  Sparkles,
  Plus,
  Trash2,
  X,
  Loader2,
  RefreshCw,
  Building2,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/tourist/empty-state";
import { BoatRateCalculator } from "@/components/owner/boat-rate-calculator";

export default function ResortServicesPage() {
  const [property, setProperty] = React.useState<any>(null);
  const [services, setServices] = React.useState<any[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState<"services" | "dispatch">("dispatch");

  // Form State
  const [serviceName, setServiceName] = React.useState("");
  const [serviceType, setServiceType] = React.useState<"boat" | "food" | "tour" | "spa">("boat");
  const [price, setPrice] = React.useState(1500);
  const [description, setDescription] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const fetchServices = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setIsLoading(false);
        return;
      }

      const { data: propData } = await supabase
        .from("properties")
        .select("*")
        .eq("owner_id", user.id)
        .eq("type", "resort")
        .limit(1);

      const ownerProp = propData && propData.length > 0 ? (propData as any[])[0] : null;
      setProperty(ownerProp);

      if (ownerProp) {
        const { data: servData } = await supabase
          .from("extra_services")
          .select("*")
          .eq("property_id", ownerProp.id)
          .order("created_at", { ascending: true });

        setServices(servData || []);
      }
    } catch {
      // Ignored
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchServices();
  }, [fetchServices]);

  const handleCreateService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!property) return;
    if (!serviceName.trim()) {
      toast.error("Service name is required");
      return;
    }

    setIsSubmitting(true);
    try {
      const supabase = createClient();
      const { data, error } = await (supabase.from("extra_services") as any)
        .insert({
          property_id: property.id,
          service_type: serviceType,
          name: serviceName.trim(),
          description: description.trim(),
          price: price,
          is_active: true,
        })
        .select()
        .single();

      if (error) throw error;

      toast.success("Service package added!", {
        description: "Tourists can view this service on your resort storefront.",
      });

      setServices((prev) => [...prev, data]);
      setIsModalOpen(false);
      setServiceName("");
      setDescription("");
      setPrice(1500);
    } catch (err: any) {
      toast.error(err.message || "Failed to create service");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteService = async (serviceId: string) => {
    if (!confirm("Are you sure you want to remove this service?")) return;
    try {
      const supabase = createClient();
      await supabase.from("extra_services").delete().eq("id", serviceId);
      setServices((prev) => prev.filter((s) => s.id !== serviceId));
      toast.success("Service removed");
    } catch {
      toast.error("Failed to delete service");
    }
  };

  const typeIcons: Record<string, any> = {
    boat: Ship,
    food: UtensilsCrossed,
    tour: MapPin,
    spa: Sparkles,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900 tracking-tight">
            Island Hopping & Extra Services
          </h1>
          <p className="text-xs sm:text-sm text-neutral-600 mt-1">
            Standardized Bretania 4-island circuit dispatch, captain manifests, and resort catering packages
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchServices}
            title="Refresh"
            className="p-2 rounded-lg border border-neutral-200 hover:bg-neutral-100 text-neutral-600 transition-colors"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
          </button>

          {property && activeTab === "services" && (
            <Button
              onClick={() => setIsModalOpen(true)}
              className="bg-black text-white hover:bg-neutral-800 text-xs h-9 px-4 font-semibold"
            >
              <Plus className="h-4 w-4 mr-1.5" />
              Add Service Package
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-neutral-200 pb-3">
        <button
          onClick={() => setActiveTab("dispatch")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === "dispatch"
              ? "bg-black text-white shadow-xs"
              : "text-neutral-600 hover:bg-neutral-100"
          }`}
        >
          ⛵ Boat Dispatch & Rate Calculator
        </button>
        <button
          onClick={() => setActiveTab("services")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === "services"
              ? "bg-black text-white shadow-xs"
              : "text-neutral-600 hover:bg-neutral-100"
          }`}
        >
          🍽️ Resort Packages & Menus ({services.length})
        </button>
      </div>

      {activeTab === "dispatch" ? (
        <div className="space-y-6">
          {/* Standardized Boat Rate Calculator */}
          <BoatRateCalculator />

          {/* Active Boat Dispatches & Captain Manifests */}
          <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
              <div>
                <h3 className="font-bold text-base text-neutral-900">
                  Today&apos;s Island Hopping Boat Dispatches
                </h3>
                <p className="text-xs text-neutral-600">
                  Coast Guard verified vessels, assigned captains, and passenger manifests
                </p>
              </div>

              <span className="text-xs font-bold text-neutral-600 bg-neutral-100 px-3 py-1 rounded-lg">
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
                      <p className="text-[11px] text-neutral-500 font-mono">
                        {voyage.regNo}
                      </p>
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
      ) : (
        <>

      {!property ? (
        <EmptyState
          icon={Building2}
          title="Create a resort listing first"
          description="You need to set up your resort profile before adding island hopping or extra services."
          actionLabel="View Dashboard"
          onAction={() => (window.location.href = "/resort")}
        />
      ) : services.length === 0 ? (
        <EmptyState
          icon={Ship}
          title="No services added yet"
          description="Expand your tourist revenue by adding Bretania island hopping boat transfers, picnic packages, or dive rentals."
          actionLabel="Add First Service"
          onAction={() => setIsModalOpen(true)}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {services.map((service) => {
            const Icon = typeIcons[service.service_type] || Ship;
            return (
              <div
                key={service.id}
                className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-xs flex flex-col justify-between gap-4 hover:border-neutral-300 transition-all"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-neutral-100 text-neutral-800">
                        <Icon className="h-4 w-4" />
                      </div>
                      <Badge variant="subtle" size="sm" className="capitalize">
                        {service.service_type}
                      </Badge>
                    </div>

                    <button
                      onClick={() => handleDeleteService(service.id)}
                      className="p-1 rounded-md text-neutral-500 hover:text-red-600 transition-colors"
                      title="Delete service"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  <h3 className="font-bold text-base text-neutral-900">
                    {service.name}
                  </h3>

                  {service.description && (
                    <p className="text-xs text-neutral-600 leading-relaxed">
                      {service.description}
                    </p>
                  )}
                </div>

                <div className="pt-3 border-t border-neutral-100 flex items-center justify-between">
                  <div>
                    <span className="text-base font-bold text-neutral-900">
                      ₱{Number(service.price).toLocaleString()}
                    </span>
                  </div>
                  <Badge variant="success" size="sm" dot>
                    Active
                  </Badge>
                </div>
              </div>
            );
          })}
        </div>
      )}
      </>
      )}

      {/* Add Service Modal */}
      {isModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
        >
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity"
            onClick={() => setIsModalOpen(false)}
          />

          <div className="relative w-full max-w-md rounded-2xl bg-white border border-neutral-200 shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
              <h3 className="font-bold text-base text-neutral-900">
                Add Resort Service Package
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-full text-neutral-500 hover:text-black"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateService} className="space-y-4 text-xs">
              <div className="space-y-1.5">
                <label className="font-semibold text-neutral-800 uppercase tracking-wider text-[11px]">
                  Service Type
                </label>
                <div className="grid grid-cols-4 gap-1.5">
                  {[
                    { id: "boat", label: "Boat" },
                    { id: "tour", label: "Tour" },
                    { id: "food", label: "Food" },
                    { id: "spa", label: "Spa" },
                  ].map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setServiceType(t.id as any)}
                      className={`py-1.5 rounded-lg border text-center font-medium capitalize ${
                        serviceType === t.id
                          ? "border-black bg-black text-white"
                          : "border-neutral-200 text-neutral-700 hover:border-neutral-300"
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold text-neutral-800 uppercase tracking-wider text-[11px]">
                  Service Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Bretania 4-Island Tour with Life Vests"
                  value={serviceName}
                  onChange={(e) => setServiceName(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-neutral-200 text-neutral-900 focus:outline-none focus:ring-1 focus:ring-black"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold text-neutral-800 uppercase tracking-wider text-[11px]">
                  Rate (₱) *
                </label>
                <input
                  type="number"
                  min={1}
                  step="any"
                  required
                  value={price || ""}
                  onChange={(e) => setPrice(e.target.value === "" ? 0 : Number(e.target.value))}
                  className="w-full h-10 px-3 rounded-lg border border-neutral-200 text-neutral-900 focus:outline-none focus:ring-1 focus:ring-black"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold text-neutral-800 uppercase tracking-wider text-[11px]">
                  Description / Inclusions
                </label>
                <textarea
                  rows={3}
                  placeholder="e.g. Includes licensed boat crew, fuel, life vests, visits to Boslon, Naked, and Hagonoy islands."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full p-3 rounded-lg border border-neutral-200 text-neutral-900 focus:outline-none focus:ring-1 focus:ring-black"
                />
              </div>

              <div className="pt-3 border-t border-neutral-100 flex items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsModalOpen(false)}
                  className="border-neutral-200 text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  size="sm"
                  className="bg-black text-white hover:bg-neutral-800 text-xs px-4"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-3 w-3 animate-spin mr-1" />
                      Saving...
                    </>
                  ) : (
                    "Publish Service"
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
