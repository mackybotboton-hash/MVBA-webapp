"use client";

import * as React from "react";
import Image from "next/image";
import { toast } from "sonner";
import {
  Building2,
  Home,
  X,
  Loader2,
  ImagePlus,
  Upload,
  Check,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { uploadFile, generateFilePath } from "@/lib/supabase/storage";
import { STORAGE_BUCKETS } from "@/lib/constants";

export interface PropertyFormData {
  id?: string;
  owner_id?: string;
  name: string;
  type: "homestay" | "resort";
  address: string;
  description: string;
  cover_image_url: string;
  promo_video_url: string;
  status: "active" | "renovating" | "full" | "closed";
}

export interface PropertyFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (property: any) => void;
  initialData?: PropertyFormData | null;
  defaultType?: "homestay" | "resort";
  isAdmin?: boolean;
}

export function PropertyFormModal({
  isOpen,
  onClose,
  onSuccess,
  initialData,
  defaultType = "homestay",
  isAdmin = false,
}: PropertyFormModalProps) {
  const [formData, setFormData] = React.useState<PropertyFormData>({
    name: "",
    type: defaultType,
    address: "Bretania, San Agustin, Surigao del Sur",
    description: "",
    cover_image_url: "",
    promo_video_url: "",
    status: "active",
  });
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isUploading, setIsUploading] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (initialData) {
      setFormData(initialData);
    } else {
      setFormData({
        name: "",
        type: defaultType,
        address: "Bretania, San Agustin, Surigao del Sur",
        description: "",
        cover_image_url: "",
        promo_video_url: "",
        status: "active",
      });
    }
  }, [initialData, defaultType, isOpen]);

  if (!isOpen) return null;

  // Handle direct photo upload from file picker
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate size (< 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image file must be less than 5MB");
      return;
    }

    setIsUploading(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const userId = user?.id || "admin";
      const filePath = generateFilePath(userId, file.name);

      const publicUrl = await uploadFile(
        STORAGE_BUCKETS.PROPERTY_IMAGES,
        filePath,
        file
      );

      setFormData((prev) => ({
        ...prev,
        cover_image_url: publicUrl,
      }));

      toast.success("Cover photo uploaded successfully!");
    } catch (err: any) {
      // Fallback to local object URL preview if storage bucket RLS is restricted
      const previewUrl = URL.createObjectURL(file);
      setFormData((prev) => ({
        ...prev,
        cover_image_url: previewUrl,
      }));
      toast.info("Photo selected for preview");
    } finally {
      setIsUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error("Property name is required");
      return;
    }

    setIsSubmitting(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        toast.error("You must be logged in to save a property");
        setIsSubmitting(false);
        return;
      }

      if (formData.id) {
        // Update existing property (both owner and admin can update)
        const { data, error } = await (supabase.from("properties") as any)
          .update({
            name: formData.name.trim(),
            type: formData.type,
            address: formData.address.trim(),
            description: formData.description.trim(),
            cover_image_url: formData.cover_image_url.trim(),
            promo_video_url: formData.promo_video_url?.trim() || "",
            status: formData.status,
          })
          .eq("id", formData.id)
          .select()
          .single();

        if (error) throw error;
        toast.success("Property updated successfully!");
        onSuccess(data);
      } else {
        // Create new property
        const ownerId = formData.owner_id || user.id;

        const { data, error } = await (supabase.from("properties") as any)
          .insert({
            owner_id: ownerId,
            name: formData.name.trim(),
            type: formData.type,
            address: formData.address.trim(),
            description: formData.description.trim(),
            cover_image_url:
              formData.cover_image_url.trim() ||
              (formData.type === "resort"
                ? "https://images.unsplash.com/photo-1540541338287-41700207dee6?auto=format&fit=crop&w=1200&q=80"
                : "https://images.unsplash.com/photo-1587061949409-02df41d5e562?auto=format&fit=crop&w=1200&q=80"),
            promo_video_url: formData.promo_video_url?.trim() || "",
            status: formData.status,
          })
          .select()
          .single();

        if (error) throw error;
        toast.success("Property listed successfully!", {
          description: "Visible in the MVBA tourist discovery marketplace.",
        });
        onSuccess(data);
      }

      onClose();
    } catch (err: any) {
      toast.error(err.message || "Failed to save property");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4"
    >
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      <div className="relative w-full max-w-lg rounded-2xl bg-white border border-neutral-200 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Sticky Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-100 shrink-0 bg-white">
          <div className="flex items-center gap-2">
            {formData.type === "resort" ? (
              <Building2 className="h-5 w-5 text-neutral-900" />
            ) : (
              <Home className="h-5 w-5 text-neutral-900" />
            )}
            <h2 className="text-base font-bold text-neutral-900">
              {formData.id ? "Edit Property Details" : "List New Property"}
            </h2>
          </div>

          <button
            onClick={onClose}
            aria-label="Close"
            className="p-1.5 rounded-full text-neutral-500 hover:text-black transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form
          id="property-modal-form"
          onSubmit={handleSubmit}
          className="flex-1 overflow-y-auto p-6 space-y-4 text-xs"
        >
          {/* Property Name */}
          <div className="space-y-1.5">
            <label className="font-bold text-neutral-900 uppercase tracking-wider text-[11px] block">
              Property Name *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Isla Tranquila Beach Homestay"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full h-10 px-3.5 rounded-xl border border-neutral-300 text-neutral-900 font-semibold placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-black focus:border-black"
            />
          </div>

          {/* Classification */}
          <div className="space-y-1.5">
            <label className="font-bold text-neutral-900 uppercase tracking-wider text-[11px] block">
              Association Classification
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setFormData({ ...formData, type: "homestay" })}
                className={`py-2 px-3 rounded-xl border text-center font-bold transition-all ${
                  formData.type === "homestay"
                    ? "border-black bg-black text-white shadow-xs"
                    : "border-neutral-300 bg-white text-neutral-700 hover:border-neutral-400 hover:bg-neutral-50"
                }`}
              >
                Homestay
              </button>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, type: "resort" })}
                className={`py-2 px-3 rounded-xl border text-center font-bold transition-all ${
                  formData.type === "resort"
                    ? "border-black bg-black text-white shadow-xs"
                    : "border-neutral-300 bg-white text-neutral-700 hover:border-neutral-400 hover:bg-neutral-50"
                }`}
              >
                Resort
              </button>
            </div>
          </div>

          {/* Address */}
          <div className="space-y-1.5">
            <label className="font-bold text-neutral-900 uppercase tracking-wider text-[11px] block">
              Location / Address in San Agustin
            </label>
            <input
              type="text"
              placeholder="e.g. Bretania Coastal Road, San Agustin, Surigao del Sur"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              className="w-full h-10 px-3.5 rounded-xl border border-neutral-300 text-neutral-900 font-medium placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-black"
            />
          </div>

          {/* Cover Photo: Direct Upload & URL */}
          <div className="space-y-1.5">
            <label className="font-bold text-neutral-900 uppercase tracking-wider text-[11px] block">
              Cover Photo
            </label>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
              />
              <Button
                type="button"
                variant="outline"
                disabled={isUploading}
                onClick={() => fileInputRef.current?.click()}
                className="h-10 px-4 border-neutral-300 bg-white text-neutral-800 hover:bg-neutral-50 text-xs font-semibold shrink-0"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="h-3.5 w-3.5 mr-1.5 text-neutral-700" />
                    Upload from Device
                  </>
                )}
              </Button>

              <input
                type="url"
                placeholder="Or paste photo URL (https://...)"
                value={formData.cover_image_url}
                onChange={(e) =>
                  setFormData({ ...formData, cover_image_url: e.target.value })
                }
                className="flex-1 h-10 px-3 rounded-xl border border-neutral-300 text-neutral-900 font-medium placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-black text-xs"
              />
            </div>

            {formData.cover_image_url && (
              <div className="relative aspect-[16/9] w-full rounded-xl overflow-hidden border border-neutral-200 mt-2 bg-neutral-100">
                <Image
                  src={formData.cover_image_url}
                  alt="Cover preview"
                  fill
                  className="object-cover"
                />
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, cover_image_url: "" })}
                  className="absolute top-2 right-2 p-1 rounded-full bg-black/60 text-white hover:bg-black"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
            <p className="text-[11px] text-neutral-600">
              Pick a photo showing your property entrance, beachfront, or island view.
            </p>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label className="font-bold text-neutral-900 uppercase tracking-wider text-[11px] block">
              Storefront Description for Tourists
            </label>
            <textarea
              rows={3}
              placeholder="Describe what makes your property special, proximity to Naked or Boslon Island, seafood dining options, etc."
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              className="w-full p-3.5 rounded-xl border border-neutral-300 text-neutral-900 font-medium placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-black resize-none leading-relaxed"
            />
          </div>

          {/* Promo Video Embed */}
          <div className="space-y-1.5">
            <label className="font-bold text-neutral-900 uppercase tracking-wider text-[11px] block">
              Promo Video URL (TikTok or YouTube Shorts)
            </label>
            <input
              type="url"
              placeholder="e.g. https://www.tiktok.com/@user/video/123 or https://youtube.com/shorts/XYZ"
              value={formData.promo_video_url}
              onChange={(e) => setFormData({ ...formData, promo_video_url: e.target.value })}
              className="w-full h-10 px-3.5 rounded-xl border border-neutral-300 text-neutral-900 font-medium placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-black"
            />
            <p className="text-[10px] text-neutral-600">
              Zero storage cost! Paste your TikTok or YouTube Shorts link here and it will embed directly on your property page.
            </p>
          </div>

          {/* Listing Status */}
          <div className="space-y-1.5">
            <label className="font-bold text-neutral-900 uppercase tracking-wider text-[11px] block">
              Listing Status
            </label>
            <select
              value={formData.status}
              onChange={(e) =>
                setFormData({ ...formData, status: e.target.value as any })
              }
              className="w-full h-10 px-3 rounded-xl border border-neutral-300 text-neutral-900 bg-white font-semibold focus:outline-none focus:ring-2 focus:ring-black"
            >
              <option value="active">Active (Visible to Tourists in Marketplace)</option>
              <option value="renovating">Renovating (Temporarily Hidden)</option>
              <option value="full">Full / Fully Booked</option>
              <option value="closed">Closed</option>
            </select>
          </div>
        </form>

        {/* Sticky Action Footer (Always visible!) */}
        <div className="px-6 py-3.5 border-t border-neutral-200 bg-neutral-50/90 shrink-0 flex items-center justify-between gap-3">
          <p className="text-[11px] text-neutral-600 font-medium hidden sm:block">
            {formData.id ? "Changes take effect immediately" : "Lists stay on MVBA marketplace"}
          </p>

          <div className="flex items-center gap-2 ml-auto">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="border-neutral-300 text-neutral-700 hover:bg-neutral-100 text-xs h-9 px-4 font-semibold"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              form="property-modal-form"
              disabled={isSubmitting || isUploading}
              className="bg-black text-white hover:bg-neutral-800 text-xs h-9 px-5 font-bold shadow-xs"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                  Saving...
                </>
              ) : formData.id ? (
                "Update Property"
              ) : (
                "Publish Property"
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
