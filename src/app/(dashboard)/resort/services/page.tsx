"use client";

import * as React from "react";
import { toast } from "sonner";
import { Plus, RefreshCw, Palmtree, Utensils, Sailboat } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { upsertService, toggleServiceStatus } from "@/app/actions/service-actions";

type ExtraService = {
  id: string;
  property_id: string;
  service_type: "Boat" | "Food" | "Tour";
  name: string;
  price: number;
  is_active: boolean;
};

export default function ResortServicesPage() {
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [propertyId, setPropertyId] = React.useState<string | null>(null);

  // Fetch Owner's Services
  const { data: services = [], isLoading, refetch } = useQuery({
    queryKey: ['resort-services'],
    queryFn: async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      // First, get the owner's property
      const { data: properties } = await supabase
        .from("properties")
        .select("id")
        .eq("owner_id", user.id)
        .limit(1);

      if (!properties || properties.length === 0) return [];
      
      const propId = properties[0].id;
      setPropertyId(propId);

      // Then fetch services for that property
      const { data, error } = await supabase
        .from("extra_services")
        .select("*")
        .eq("property_id", propId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as ExtraService[];
    }
  });

  // Toggle Status Mutation (Optimistic)
  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => toggleServiceStatus(id, isActive),
    onMutate: async ({ id, isActive }) => {
      await queryClient.cancelQueries({ queryKey: ['resort-services'] });
      const previousServices = queryClient.getQueryData<ExtraService[]>(['resort-services']);

      if (previousServices) {
        queryClient.setQueryData<ExtraService[]>(['resort-services'], old => {
          if (!old) return [];
          return old.map(s => s.id === id ? { ...s, is_active: isActive } : s);
        });
      }

      return { previousServices };
    },
    onError: (err, newStatus, context) => {
      if (context?.previousServices) {
        queryClient.setQueryData(['resort-services'], context.previousServices);
      }
      toast.error("Failed to update status.");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['resort-services'] });
    }
  });

  // Create Package Mutation
  const createMutation = useMutation({
    mutationFn: (payload: any) => upsertService(payload),
    onSuccess: (res) => {
      if (res.success) {
        toast.success("Service package created successfully!");
        setIsModalOpen(false);
        queryClient.invalidateQueries({ queryKey: ['resort-services'] });
      } else {
        toast.error("Failed to create package: " + res.error);
      }
    },
    onError: (err: any) => {
      toast.error("An error occurred: " + err.message);
    }
  });

  const handleCreateSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!propertyId) {
      toast.error("No property found for this account.");
      return;
    }

    const formData = new FormData(e.currentTarget);
    const payload = {
      property_id: propertyId,
      name: formData.get("name") as string,
      service_type: formData.get("service_type") as "Boat" | "Food" | "Tour",
      price: Number(formData.get("price")),
    };

    createMutation.mutate(payload);
  };

  const getIcon = (type: string) => {
    switch(type) {
      case 'Boat': return <Sailboat className="h-4 w-4 text-blue-500" />;
      case 'Food': return <Utensils className="h-4 w-4 text-orange-500" />;
      case 'Tour': return <Palmtree className="h-4 w-4 text-emerald-500" />;
      default: return null;
    }
  };

  return (
    <div className="space-y-6 max-w-6xl pb-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900 tracking-tight">Extra Services</h1>
          <p className="text-xs sm:text-sm text-neutral-600 mt-1 font-medium">Manage and upsell packages to your guests during checkout.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => refetch()} className="p-2 rounded-xl border border-neutral-200 hover:bg-neutral-100 text-neutral-600 transition-colors">
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
          </button>
          <Button onClick={() => setIsModalOpen(true)} className="bg-black text-white hover:bg-neutral-800 rounded-xl">
            <Plus className="h-4 w-4 mr-2" />
            Create Package
          </Button>
        </div>
      </div>

      <div className="rounded-2xl border border-neutral-200 bg-white overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-neutral-200 bg-neutral-50 text-neutral-900 uppercase tracking-wider font-bold">
                <th className="px-5 py-3.5">Service Name</th>
                <th className="px-5 py-3.5">Category</th>
                <th className="px-5 py-3.5">Price (Flat Fee)</th>
                <th className="px-5 py-3.5 text-right">Status (Active)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 font-medium">
              {services.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-16 text-center text-neutral-500 text-xs">No services found. Click "Create Package" to add one.</td>
                </tr>
              ) : (
                services.map((service) => (
                  <tr key={service.id} className="hover:bg-neutral-50/60 transition-colors">
                    <td className="px-5 py-4">
                      <p className="font-bold text-neutral-900 text-sm">{service.name}</p>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        {getIcon(service.service_type)}
                        <span className="text-neutral-700">{service.service_type}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <p className="font-bold text-neutral-900">₱{Number(service.price).toLocaleString()}</p>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <Switch 
                        checked={service.is_active} 
                        onCheckedChange={(checked) => toggleMutation.mutate({ id: service.id, isActive: checked })}
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Package Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <form onSubmit={handleCreateSubmit}>
            <DialogHeader>
              <DialogTitle>Create Extra Service</DialogTitle>
              <DialogDescription>
                Add a new package that guests can select when booking a room.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Package Name</Label>
                <Input id="name" name="name" placeholder="e.g. Island Hopping Tour" required />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="service_type">Category</Label>
                <select 
                  id="service_type" 
                  name="service_type" 
                  required
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <option value="Tour">Tour</option>
                  <option value="Boat">Boat Rental</option>
                  <option value="Food">Food / Meals</option>
                </select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="price">Price (₱)</Label>
                <Input id="price" name="price" type="number" step="0.01" min="0" placeholder="e.g. 1500" required />
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending} className="bg-black text-white hover:bg-neutral-800">
                {createMutation.isPending ? "Saving..." : "Create Package"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
