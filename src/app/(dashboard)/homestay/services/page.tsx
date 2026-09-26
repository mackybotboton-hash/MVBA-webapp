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
  Search
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/tourist/empty-state";

export default function HomestayServicesPage() {
  const [property, setProperty] = React.useState<any>(null);
  const [services, setServices] = React.useState<any[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  
  const [searchQuery, setSearchQuery] = React.useState("");

  // Form State
  const [serviceName, setServiceName] = React.useState("");
  const [serviceType, setServiceType] = React.useState<"boat" | "food" | "tour" | "spa">("boat");
  const [price, setPrice] = React.useState(1500);
  const [description, setDescription] = React.useState("");
  const [paymentType, setPaymentType] = React.useState<"upfront" | "cash">("cash");
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
        .eq("type", "homestay")
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

  const filteredServices = React.useMemo(() => {
    if (!searchQuery.trim()) return services;
    const q = searchQuery.toLowerCase();
    return services.filter(s => 
      s.name?.toLowerCase().includes(q) || 
      s.service_type?.toLowerCase().includes(q)
    );
  }, [services, searchQuery]);

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
          payment_type: paymentType,
          is_active: true,
        })
        .select()
        .single();

      if (error) throw error;

      toast.success("Service package added!", {
        description: "Tourists can view this service on your homestay storefront.",
      });

      setServices((prev) => [...prev, data]);
      setIsModalOpen(false);
      setServiceName("");
      setDescription("");
      setPrice(1500);
      setPaymentType("cash");
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
            Homestay Services & Tours
          </h1>
          <p className="text-xs sm:text-sm text-neutral-600 mt-1">
            Manage add-on services that tourists can book alongside their rooms.
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

          {property && (
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

      {/* Search */}
      {property && services.length > 0 && (
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
          <input
            type="text"
            placeholder="Search services..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-9 py-2 text-sm border border-neutral-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-black bg-white"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-neutral-100 text-neutral-500 transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}

      {!property ? (
        <EmptyState
          icon={Building2}
          title="Create a homestay listing first"
          description="You need to set up your homestay profile before adding extra services."
          actionLabel="View Dashboard"
          onAction={() => (window.location.href = "/homestay")}
        />
      ) : services.length === 0 ? (
        <EmptyState
          icon={Ship}
          title="No services added yet"
          description="Expand your tourist revenue by offering island hopping, food packages, or other tours."
          actionLabel="Add First Service"
          onAction={() => setIsModalOpen(true)}
        />
      ) : filteredServices.length === 0 && searchQuery.trim() !== "" ? (
        <div className="py-16 text-center text-neutral-500 text-sm">
          No services found matching &quot;{searchQuery}&quot;
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredServices.map((service) => {
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
                      <Badge variant={service.payment_type === "upfront" ? "default" : "secondary"} size="sm">
                        {service.payment_type === "upfront" ? "Pay Online" : "Pay at Property"}
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
                    <p className="text-xs text-neutral-600 leading-relaxed line-clamp-3">
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
                Add Homestay Service Package
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

              <div className="grid grid-cols-2 gap-4">
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
                    Payment Type
                  </label>
                  <select
                    value={paymentType}
                    onChange={(e) => setPaymentType(e.target.value as any)}
                    className="w-full h-10 px-3 rounded-lg border border-neutral-200 text-neutral-900 focus:outline-none focus:ring-1 focus:ring-black bg-white"
                  >
                    <option value="cash">Pay at Property</option>
                    <option value="upfront">Pay Online (Upfront)</option>
                  </select>
                </div>
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
