"use client";

import * as React from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Building2, Save, Loader2, Link as LinkIcon, Camera, MapPin, Clock } from "lucide-react";

export function PropertyProfileForm({ propertyType }: { propertyType: "homestay" | "resort" }) {
  const [property, setProperty] = React.useState<any>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);

  // Form Fields
  const [description, setDescription] = React.useState("");
  const [address, setAddress] = React.useState("");
  const [coverImageUrl, setCoverImageUrl] = React.useState("");
  const [promoVideoUrl, setPromoVideoUrl] = React.useState("");
  const [checkInTime, setCheckInTime] = React.useState("14:00");
  const [checkOutTime, setCheckOutTime] = React.useState("12:00");
  
  // Social Links
  const [facebookUrl, setFacebookUrl] = React.useState("");
  const [messengerUrl, setMessengerUrl] = React.useState("");
  
  // Policies (Checkboxes + Custom text)
  const [policies, setPolicies] = React.useState({
    noSmoking: false,
    petsAllowed: false,
    partiesAllowed: false,
    quietHours: false,
    customRules: "",
  });

  React.useEffect(() => {
    async function fetchProperty() {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: propData } = await supabase
          .from("properties")
          .select("*")
          .eq("owner_id", user.id)
          .eq("type", propertyType)
          .limit(1)
          .single();

        if (propData) {
          const prop = propData as any;
          setProperty(prop);
          setDescription(prop.description || "");
          setAddress(prop.address || "");
          setCoverImageUrl(prop.cover_image_url || "");
          setPromoVideoUrl(prop.promo_video_url || "");
          setCheckInTime(prop.check_in_time || "14:00");
          setCheckOutTime(prop.check_out_time || "12:00");
          setFacebookUrl(prop.facebook_url || "");
          setMessengerUrl(prop.messenger_url || "");

          if (prop.policies) {
            try {
              const parsedPolicies = JSON.parse(prop.policies);
              setPolicies((prev) => ({ ...prev, ...parsedPolicies }));
            } catch (e) {
              console.error("Failed to parse policies");
            }
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    }
    fetchProperty();
  }, [propertyType]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!property) {
      toast.error("Please create a property listing from your dashboard first.");
      return;
    }

    setIsSaving(true);
    try {
      const supabase = createClient();
      const { error } = await (supabase.from("properties") as any)
        .update({
          description,
          address,
          cover_image_url: coverImageUrl,
          promo_video_url: promoVideoUrl,
          check_in_time: checkInTime,
          check_out_time: checkOutTime,
          facebook_url: facebookUrl,
          messenger_url: messengerUrl,
          policies: JSON.stringify(policies),
        })
        .eq("id", property.id);

      if (error) throw error;
      toast.success("Property profile and policies saved!");
    } catch (err: any) {
      toast.error(err.message || "Failed to save profile");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-neutral-400" />
      </div>
    );
  }

  if (!property) {
    return (
      <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed border-neutral-200 rounded-xl bg-neutral-50 p-6 text-center">
        <Building2 className="h-10 w-10 text-neutral-400 mb-3" />
        <h3 className="text-sm font-bold text-neutral-900">No Property Found</h3>
        <p className="text-xs text-neutral-500 max-w-sm mt-1">
          You need to create your {propertyType} listing in the main dashboard before editing its profile and policies.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSave} className="space-y-8 max-w-4xl">
      {/* Basic Info Section */}
      <section className="bg-white rounded-2xl border border-neutral-200 p-6 space-y-6 shadow-sm">
        <div className="border-b border-neutral-100 pb-4">
          <h2 className="text-lg font-bold text-neutral-900">Property Overview</h2>
          <p className="text-xs text-neutral-500 mt-1">Manage your public description, photos, and location.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4 col-span-2">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-neutral-800 uppercase tracking-wider">Property Description</label>
              <textarea
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe your property to tourists..."
                className="w-full p-3 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-neutral-400 transition-all"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-neutral-800 uppercase tracking-wider">Complete Address</label>
              <div className="relative">
                <MapPin className="absolute left-3 top-3 h-4 w-4 text-neutral-400" />
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="e.g. Purok 5, Bretania, San Agustin"
                  className="w-full pl-9 pr-3 h-10 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-neutral-400 transition-all"
                />
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-neutral-800 uppercase tracking-wider">Cover Image URL</label>
            <div className="relative">
              <Camera className="absolute left-3 top-3 h-4 w-4 text-neutral-400" />
              <input
                type="url"
                value={coverImageUrl}
                onChange={(e) => setCoverImageUrl(e.target.value)}
                placeholder="https://example.com/image.jpg"
                className="w-full pl-9 pr-3 h-10 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-neutral-400 transition-all"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-neutral-800 uppercase tracking-wider">Promo Video URL</label>
            <div className="relative">
              <LinkIcon className="absolute left-3 top-3 h-4 w-4 text-neutral-400" />
              <input
                type="url"
                value={promoVideoUrl}
                onChange={(e) => setPromoVideoUrl(e.target.value)}
                placeholder="YouTube or TikTok link"
                className="w-full pl-9 pr-3 h-10 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-neutral-400 transition-all"
              />
            </div>
          </div>
        </div>

        {/* Social Links */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-neutral-800 uppercase tracking-wider">Facebook Page URL</label>
            <div className="relative">
              <LinkIcon className="absolute left-3 top-3 h-4 w-4 text-neutral-400" />
              <input
                type="url"
                value={facebookUrl}
                onChange={(e) => setFacebookUrl(e.target.value)}
                placeholder="https://facebook.com/yourpage"
                className="w-full pl-9 pr-3 h-10 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-neutral-400 transition-all"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-neutral-800 uppercase tracking-wider">Messenger Link</label>
            <div className="relative">
              <LinkIcon className="absolute left-3 top-3 h-4 w-4 text-neutral-400" />
              <input
                type="url"
                value={messengerUrl}
                onChange={(e) => setMessengerUrl(e.target.value)}
                placeholder="https://m.me/yourpage"
                className="w-full pl-9 pr-3 h-10 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-neutral-400 transition-all"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Policies Section */}
      <section className="bg-white rounded-2xl border border-neutral-200 p-6 space-y-6 shadow-sm">
        <div className="border-b border-neutral-100 pb-4">
          <h2 className="text-lg font-bold text-neutral-900">House Rules & Policies</h2>
          <p className="text-xs text-neutral-500 mt-1">Set clear expectations for tourists booking your property.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Check-in / Check-out */}
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-neutral-800 uppercase tracking-wider">Check-in Time</label>
              <div className="relative">
                <Clock className="absolute left-3 top-3 h-4 w-4 text-neutral-400" />
                <input
                  type="time"
                  value={checkInTime}
                  onChange={(e) => setCheckInTime(e.target.value)}
                  className="w-full pl-9 pr-3 h-10 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-neutral-400 transition-all"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-neutral-800 uppercase tracking-wider">Check-out Time</label>
              <div className="relative">
                <Clock className="absolute left-3 top-3 h-4 w-4 text-neutral-400" />
                <input
                  type="time"
                  value={checkOutTime}
                  onChange={(e) => setCheckOutTime(e.target.value)}
                  className="w-full pl-9 pr-3 h-10 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-neutral-400 transition-all"
                />
              </div>
            </div>
          </div>

          {/* Standard Policies */}
          <div className="space-y-3">
            <label className="text-xs font-bold text-neutral-800 uppercase tracking-wider">Standard Rules</label>
            <div className="space-y-2">
              {[
                { id: "noSmoking", label: "No Smoking indoors" },
                { id: "petsAllowed", label: "Pets Allowed" },
                { id: "partiesAllowed", label: "Parties/Events Allowed" },
                { id: "quietHours", label: "Quiet hours after 10:00 PM" },
              ].map((rule) => (
                <label key={rule.id} className="flex items-center gap-3 p-3 rounded-xl border border-neutral-100 hover:bg-neutral-50 cursor-pointer transition-colors">
                  <input
                    type="checkbox"
                    checked={policies[rule.id as keyof typeof policies] as boolean}
                    onChange={(e) => setPolicies({ ...policies, [rule.id]: e.target.checked })}
                    className="h-4 w-4 rounded border-neutral-300 text-black focus:ring-black accent-black"
                  />
                  <span className="text-sm font-medium text-neutral-700">{rule.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Custom Policies */}
          <div className="col-span-1 md:col-span-2 space-y-1.5">
            <label className="text-xs font-bold text-neutral-800 uppercase tracking-wider">Additional Custom Rules</label>
            <textarea
              rows={4}
              value={policies.customRules}
              onChange={(e) => setPolicies({ ...policies, customRules: e.target.value })}
              placeholder="e.g. Please wash dishes before check-out. Do not hang wet clothes on the balcony railing."
              className="w-full p-3 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-neutral-400 transition-all"
            />
          </div>
        </div>
      </section>

      <div className="flex justify-end pt-2">
        <Button
          type="submit"
          disabled={isSaving}
          className="bg-black text-white hover:bg-neutral-800 rounded-xl px-8"
        >
          {isSaving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Save Profile & Policies
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
