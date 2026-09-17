"use client";

import * as React from "react";
import Image from "next/image";
import { toast } from "sonner";
import {
  BedDouble,
  X,
  Loader2,
  Users,
  PhilippinePeso,
  Upload,
  Image as ImageIcon,
  Sparkles,
  Plus,
  Trash2,
  Camera,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { uploadFile, generateFilePath } from "@/lib/supabase/storage";
import { STORAGE_BUCKETS } from "@/lib/constants";

const SAMPLE_ANGLE_PRESETS = [
  { label: "Main Bed Angle", url: "https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=800&q=80" },
  { label: "Bathroom / Ensuite", url: "https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=800&q=80" },
  { label: "Balcony / Sea View", url: "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=800&q=80" },
  { label: "Aircon & Interior", url: "https://images.unsplash.com/photo-1566665797739-1674de7a421a?auto=format&fit=crop&w=800&q=80" },
  { label: "Entrance / Wardrobe", url: "https://images.unsplash.com/photo-1595526114035-0d45ed16cfbf?auto=format&fit=crop&w=800&q=80" },
];

export interface RoomFormData {
  id?: string;
  property_id: string;
  name: string;
  description: string;
  base_price: number;
  max_capacity: number;
  is_active: boolean;
  image_url?: string;
  images?: string[];
  room_images?: { id?: string; image_url: string; display_order?: number }[];
}

export interface RoomFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (room: any) => void;
  propertyId: string;
  initialData?: RoomFormData | null;
}

export function RoomFormModal({
  isOpen,
  onClose,
  onSuccess,
  propertyId,
  initialData,
}: RoomFormModalProps) {
  const [formData, setFormData] = React.useState<RoomFormData>({
    property_id: propertyId,
    name: "",
    description: "",
    base_price: 1500,
    max_capacity: 2,
    is_active: true,
  });

  const [images, setImages] = React.useState<string[]>([]);
  const [urlInput, setUrlInput] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isUploading, setIsUploading] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (initialData) {
      // Gather all images from room_images or image_url
      const loadedImages: string[] = [];
      if (initialData.room_images && initialData.room_images.length > 0) {
        initialData.room_images.forEach((img) => {
          if (img.image_url && !loadedImages.includes(img.image_url)) {
            loadedImages.push(img.image_url);
          }
        });
      } else if (initialData.image_url) {
        loadedImages.push(initialData.image_url);
      } else if (initialData.images && initialData.images.length > 0) {
        loadedImages.push(...initialData.images);
      }

      setFormData(initialData);
      setImages(loadedImages);
    } else {
      setFormData({
        property_id: propertyId,
        name: "",
        description: "",
        base_price: 1500,
        max_capacity: 2,
        is_active: true,
      });
      setImages([]);
    }
  }, [initialData, propertyId, isOpen]);


  if (!isOpen) return null;

  // Handle multiple file upload from gallery / device
  const handleMultipleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    const newUploadedUrls: string[] = [];

    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const userId = user?.id || "host";

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file.size > 5 * 1024 * 1024) continue;

        try {
          const filePath = generateFilePath(userId, file.name);
          const publicUrl = await uploadFile(
            STORAGE_BUCKETS.ROOM_GALLERIES,
            filePath,
            file
          );
          newUploadedUrls.push(publicUrl);
        } catch {
          // Local blob preview fallback
          const previewUrl = URL.createObjectURL(file);
          newUploadedUrls.push(previewUrl);
        }
      }

      if (newUploadedUrls.length > 0) {
        setImages((prev) => [...prev, ...newUploadedUrls].slice(0, 10));
        toast.success(`Added ${newUploadedUrls.length} room photo(s)!`);
      }
    } catch {
      toast.error("Failed to upload photos");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleAddUrl = (e: React.FormEvent) => {
    e.preventDefault();
    if (!urlInput.trim()) return;
    if (images.length >= 10) {
      toast.error("Maximum 10 room photos allowed");
      return;
    }
    setImages((prev) => [...prev, urlInput.trim()]);
    setUrlInput("");
    toast.success("Photo added to gallery");
  };

  const handleRemoveImage = (indexToRemove: number) => {
    setImages((prev) => prev.filter((_, idx) => idx !== indexToRemove));
  };

  const handleSetCover = (indexToCover: number) => {
    setImages((prev) => {
      const copy = [...prev];
      const [chosen] = copy.splice(indexToCover, 1);
      return [chosen, ...copy];
    });
    toast.success("Set as primary cover photo");
  };

  const handleLoadAll5Presets = () => {
    setImages(SAMPLE_ANGLE_PRESETS.map((p) => p.url));
    toast.success("Loaded 5 standard room angles (Bed, Bath, Balcony, Aircon, Entrance)");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error("Room name is required");
      return;
    }

    if (formData.base_price <= 0) {
      toast.error("Please enter a valid base price");
      return;
    }

    setIsSubmitting(true);
    try {
      const supabase = createClient();
      let savedRoom: any = null;

      const finalImages = images;


      if (formData.id) {
        // 1. Update room record
        const { data, error } = await (supabase.from("rooms") as any)
          .update({
            name: formData.name.trim(),
            description: formData.description.trim(),
            base_price: formData.base_price,
            max_capacity: formData.max_capacity,
            is_active: formData.is_active,
          })
          .eq("id", formData.id)
          .select()
          .single();

        if (error) throw error;
        savedRoom = data;

        // 2. Refresh room_images table (delete old, insert new)
        try {
          await supabase.from("room_images").delete().eq("room_id", formData.id);

          const imageRows = finalImages.map((url, idx) => ({
            room_id: formData.id,
            image_url: url,
            display_order: idx,
          }));

          await (supabase.from("room_images") as any).insert(imageRows);
        } catch {
          // Ignored
        }

        toast.success("Room details and photo gallery updated!");
      } else {
        // 1. Insert new room
        const { data, error } = await (supabase.from("rooms") as any)
          .insert({
            property_id: propertyId,
            name: formData.name.trim(),
            description: formData.description.trim(),
            base_price: formData.base_price,
            max_capacity: formData.max_capacity,
            is_active: formData.is_active,
          })
          .select()
          .single();

        if (error) throw error;
        savedRoom = data;

        // 2. Insert all gallery photos into room_images table
        try {
          const imageRows = finalImages.map((url, idx) => ({
            room_id: savedRoom.id,
            image_url: url,
            display_order: idx,
          }));

          await (supabase.from("room_images") as any).insert(imageRows);
        } catch {
          // Ignored
        }

        toast.success(`Room added with ${finalImages.length} photo angles!`, {
          description: "Tourists can now browse all angles of this room on the marketplace.",
        });
      }

      // Structure object for immediate local UI sync
      if (savedRoom) {
        savedRoom.room_images = finalImages.map((url, idx) => ({
          id: `img-${idx}`,
          image_url: url,
          display_order: idx,
        }));
        savedRoom.image_url = finalImages[0];
      }

      onSuccess(savedRoom);
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Failed to save room");
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

      <div className="relative w-full max-w-xl rounded-2xl bg-white border border-neutral-200 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Sticky Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-100 shrink-0 bg-white">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-black text-white">
              <BedDouble className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-neutral-900">
                {formData.id ? "Edit Room & Photo Gallery" : "Add Room with Photo Gallery"}
              </h2>
              <p className="text-[11px] text-neutral-600 font-medium">
                Add at least 5 photos for different angles (bed, bathroom, view, amenities)
              </p>
            </div>
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
          id="room-modal-form"
          onSubmit={handleSubmit}
          className="flex-1 overflow-y-auto p-6 space-y-5 text-xs"
        >
          {/* Room Name */}
          <div className="space-y-1.5">
            <label className="font-bold text-neutral-900 uppercase tracking-wider text-[11px] block">
              Room Name *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Deluxe Island View Room with Balcony"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full h-10 px-3.5 rounded-xl border border-neutral-300 text-neutral-900 font-semibold placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-black"
            />
          </div>

          {/* Pricing & Capacity Grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="font-bold text-neutral-900 uppercase tracking-wider text-[11px] block">
                Base Price (₱ / night) *
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-neutral-600">
                  ₱
                </span>
                <input
                  type="number"
                  required
                  min={1}
                  step="any"
                  value={formData.base_price || ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      base_price: e.target.value === "" ? 0 : Number(e.target.value),
                    })
                  }
                  className="w-full h-10 pl-8 pr-3 rounded-xl border border-neutral-300 text-neutral-900 font-bold focus:outline-none focus:ring-2 focus:ring-black"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="font-bold text-neutral-900 uppercase tracking-wider text-[11px] block">
                Max Guests *
              </label>
              <div className="relative">
                <Users className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-neutral-500" />
                <input
                  type="number"
                  required
                  min={1}
                  max={20}
                  value={formData.max_capacity}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      max_capacity: Number(e.target.value),
                    })
                  }
                  className="w-full h-10 pl-8 pr-3 rounded-xl border border-neutral-300 text-neutral-900 font-semibold focus:outline-none focus:ring-2 focus:ring-black"
                />
              </div>
            </div>
          </div>

          {/* 📸 Multi-Angle Room Photos (At least 5 recommended) */}
          <div className="space-y-2.5 pt-2 border-t border-neutral-100">
            <div className="flex items-center justify-between">
              <div>
                <label className="font-bold text-neutral-900 uppercase tracking-wider text-[11px] block">
                  Room Photos ({images.length} of 5+ angles added)
                </label>
                <p className="text-[11px] text-neutral-600 font-medium">
                  Add photos showing the bed, bathroom, air conditioning, and views.
                </p>
              </div>

              <button
                type="button"
                onClick={handleLoadAll5Presets}
                className="text-[11px] font-bold text-neutral-700 hover:text-black flex items-center gap-1 bg-neutral-100 hover:bg-neutral-200 px-2.5 py-1 rounded-lg transition-colors"
              >
                <Sparkles className="h-3 w-3" />
                Load 5 Angle Presets
              </button>
            </div>

            {/* Photo Gallery Grid */}
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2.5 pt-1">
              {images.map((imgUrl, index) => (
                <div
                  key={`${imgUrl}-${index}`}
                  className="relative group aspect-square rounded-xl overflow-hidden border border-neutral-200 bg-neutral-100 shadow-xs"
                >
                  <Image
                    src={imgUrl}
                    alt={`Room angle ${index + 1}`}
                    fill
                    className="object-cover"
                  />

                  {/* Badge: #1 is Cover */}
                  <div className="absolute top-1.5 left-1.5">
                    {index === 0 ? (
                      <span className="bg-black text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow-xs">
                        Cover
                      </span>
                    ) : (
                      <span className="bg-black/60 text-white text-[9px] font-semibold px-1 py-0.5 rounded">
                        #{index + 1}
                      </span>
                    )}
                  </div>

                  {/* Actions overlay */}
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1 p-1">
                    {index !== 0 && (
                      <button
                        type="button"
                        onClick={() => handleSetCover(index)}
                        className="text-[9px] font-bold bg-white text-black px-1.5 py-0.5 rounded hover:bg-neutral-200"
                        title="Set as main cover"
                      >
                        Make Cover
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleRemoveImage(index)}
                      className="p-1 rounded-full bg-red-600 text-white hover:bg-red-700"
                      title="Remove photo"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              ))}

              {/* Add Photo Slot Button */}
              {images.length < 10 && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="aspect-square rounded-xl border-2 border-dashed border-neutral-300 hover:border-black flex flex-col items-center justify-center text-neutral-600 hover:text-black transition-all bg-neutral-50/60"
                >
                  {isUploading ? (
                    <Loader2 className="h-5 w-5 animate-spin text-neutral-500" />
                  ) : (
                    <>
                      <Camera className="h-5 w-5 mb-1" />
                      <span className="text-[10px] font-bold">+ Add Angle</span>
                    </>
                  )}
                </button>
              )}
            </div>

            {/* Upload Buttons Toolbar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-2">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*"
                onChange={handleMultipleFileUpload}
                className="hidden"
              />
              <Button
                type="button"
                variant="outline"
                disabled={isUploading}
                onClick={() => fileInputRef.current?.click()}
                className="h-9 px-3.5 border-neutral-300 bg-white text-neutral-800 hover:bg-neutral-50 text-xs font-semibold shrink-0"
              >
                <Upload className="h-3.5 w-3.5 mr-1.5 text-neutral-700" />
                Upload Photos from Device (Multi-select)
              </Button>

              <div className="flex items-center gap-1.5 flex-1">
                <input
                  type="url"
                  placeholder="Or paste photo URL..."
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  className="flex-1 h-9 px-3 rounded-xl border border-neutral-300 text-neutral-900 font-medium placeholder:text-neutral-500 focus:outline-none focus:ring-1 focus:ring-black text-xs"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleAddUrl}
                  disabled={!urlInput.trim()}
                  className="h-9 px-3 border-neutral-300 text-xs font-semibold"
                >
                  Add URL
                </Button>
              </div>
            </div>

            {images.length < 5 && (
              <p className="text-[11px] text-amber-600 font-medium pt-0.5">
                Tip: Listings with 5+ photos (Bed, Bath, View, Amenities) receive 3x more bookings from tourists.
              </p>
            )}
          </div>

          {/* Amenities & Features Description */}
          <div className="space-y-1.5 pt-2 border-t border-neutral-100">
            <label className="font-bold text-neutral-900 uppercase tracking-wider text-[11px] block">
              Room Amenities & Features
            </label>
            <textarea
              rows={3}
              placeholder="e.g. 1 Queen Bed, Air conditioner, Private toilet & hot shower, Island view window, Electric kettle, Free Wi-Fi"
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              className="w-full p-3.5 rounded-xl border border-neutral-300 text-neutral-900 font-medium placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-black resize-none leading-relaxed"
            />
          </div>

          {/* Active Checkbox */}
          <label className="flex items-center gap-2.5 cursor-pointer pt-1">
            <input
              type="checkbox"
              checked={formData.is_active}
              onChange={(e) =>
                setFormData({ ...formData, is_active: e.target.checked })
              }
              className="h-4 w-4 rounded border-neutral-300 text-black focus:ring-black"
            />
            <span className="text-xs font-semibold text-neutral-800">
              Active and visible to tourists on the marketplace
            </span>
          </label>
        </form>

        {/* Sticky Action Footer */}
        <div className="px-6 py-3.5 border-t border-neutral-200 bg-neutral-50 shrink-0 flex items-center justify-between gap-3">
          <span className="text-[11px] text-neutral-600 font-semibold hidden sm:inline">
            {images.length} photo angles ready to publish
          </span>

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
              form="room-modal-form"
              disabled={isSubmitting || isUploading}
              className="bg-black text-white hover:bg-neutral-800 text-xs h-9 px-5 font-bold shadow-xs"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                  Saving Room & Photos...
                </>
              ) : formData.id ? (
                "Update Room & Photos"
              ) : (
                "Publish Room & Photos"
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
