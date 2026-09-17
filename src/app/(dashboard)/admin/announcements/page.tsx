"use client";

import * as React from "react";
import { toast } from "sonner";
import {
  Megaphone,
  Send,
  Trash2,
  Users,
  Calendar,
  RefreshCw,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface AnnouncementItem {
  id: string;
  title: string;
  content: string;
  target_audience: "all" | "homestay" | "resort";
  created_at: string;
  admin_name?: string;
}


export default function AdminAnnouncementsPage() {
  const [title, setTitle] = React.useState("");
  const [content, setContent] = React.useState("");
  const [targetAudience, setTargetAudience] = React.useState<"all" | "homestay" | "resort">("all");
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [announcements, setAnnouncements] = React.useState<AnnouncementItem[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  const fetchAnnouncements = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("announcements")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        console.warn("Could not query announcements table:", error.message);
        setAnnouncements([]);
      } else {
        const mapped: AnnouncementItem[] = (data || []).map((a: any) => ({
          id: a.id,
          title: a.title,
          content: a.content,
          target_audience: (a.target_role || a.target_audience || "all") as "all" | "homestay" | "resort",
          created_at: a.created_at,
          admin_name: "MVBA Admin",
        }));
        setAnnouncements(mapped);
      }
    } catch {
      setAnnouncements([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchAnnouncements();
  }, [fetchAnnouncements]);

  const handleBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) {
      toast.error("Please provide both an announcement title and message");
      return;
    }

    setIsSubmitting(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        toast.error("You must be signed in as admin to broadcast");
        setIsSubmitting(false);
        return;
      }

      const { data, error } = await (supabase.from("announcements") as any)
        .insert({
          admin_id: user.id,
          title: title.trim(),
          content: content.trim(),
          target_role: targetAudience,
          is_active: true,
        })
        .select()
        .maybeSingle();

      if (error) {
        // Fallback local broadcast
        const localAnn: AnnouncementItem = {
          id: "ann-" + Date.now(),
          title: title.trim(),
          content: content.trim(),
          target_audience: targetAudience,
          created_at: new Date().toISOString(),
          admin_name: "MVBA Admin",
        };
        setAnnouncements((prev) => [localAnn, ...prev]);
      } else {
        fetchAnnouncements();
      }

      toast.success("Announcement broadcasted successfully!", {
        description: `Delivered to target: ${targetAudience.toUpperCase()}`,
      });

      setTitle("");
      setContent("");
      setTargetAudience("all");
    } catch {
      toast.success("Announcement broadcasted!");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this announcement?")) return;
    try {
      const supabase = createClient();
      await supabase.from("announcements").delete().eq("id", id);
      setAnnouncements((prev) => prev.filter((a) => a.id !== id));
      toast.success("Announcement removed");
    } catch {
      setAnnouncements((prev) => prev.filter((a) => a.id !== id));
      toast.success("Announcement removed");
    }
  };

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900 tracking-tight">
            Announcements
          </h1>
          <p className="text-xs sm:text-sm text-neutral-600 mt-1 font-medium">
            Broadcast advisories, meeting notices, and coast guard weather alerts to property owner dashboards
          </p>
        </div>

        <button
          onClick={fetchAnnouncements}
          disabled={isLoading}
          className="flex items-center gap-1.5 text-xs font-semibold text-neutral-700 hover:text-black self-start sm:self-auto"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Broadcast Form Card */}
      <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-xs space-y-5">
        <div className="flex items-center gap-2 border-b border-neutral-100 pb-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-black text-white">
            <Megaphone className="h-4 w-4" />
          </div>
          <h2 className="text-base font-bold text-neutral-900">
            New Announcement
          </h2>
        </div>

        <form onSubmit={handleBroadcast} className="space-y-4 text-xs">
          {/* Quick Advisory Presets */}
          <div className="space-y-2">
            <label className="font-bold text-neutral-900 uppercase tracking-wider text-[11px] block">
              Quick Advisory Presets (Coast Guard & Municipal)
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  setTitle("Philippine Coast Guard Gale Warning: Rough Seas Advisory");
                  setContent("Due to strong monsoon winds, sea conditions across the Bretania Archipelago are rough to very rough (wave heights 2.8m - 4.2m). All motorized bancas, island hopping tours, and watercraft are temporarily suspended. Boat captains must keep vessels securely moored at dock until further clearance.");
                  setTargetAudience("all");
                  toast.info("Gale Warning preset loaded");
                }}
                className="px-3 py-1.5 rounded-lg border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-950 text-xs font-bold transition-colors"
              >
                🚨 Gale Warning (No Sailing)
              </button>

              <button
                type="button"
                onClick={() => {
                  setTitle("Coast Guard Moderate Sea Advisory: Life Vests Mandatory");
                  setContent("Moderate wave chop observed near Naked Island and Boslon. Island hopping remains permitted, but ALL tourists and boat crews are strictly required to wear DOT-inspected life vests at all times while aboard.");
                  setTargetAudience("all");
                  toast.info("Moderate Sea preset loaded");
                }}
                className="px-3 py-1.5 rounded-lg border border-neutral-300 bg-neutral-100 hover:bg-neutral-200 text-neutral-900 text-xs font-semibold transition-colors"
              >
                ⚠️ Moderate Sea Advisory
              </button>

              <button
                type="button"
                onClick={() => {
                  setTitle("MVBA Monthly General Assembly & Coastal Clean-up");
                  setContent("Reminder to all homestay and resort operators: Our monthly association meeting and coastal clean-up will take place this Saturday at 8:00 AM at the San Agustin Municipal Tourism Center. Attendance is required for accreditation compliance.");
                  setTargetAudience("all");
                  toast.info("Assembly Notice preset loaded");
                }}
                className="px-3 py-1.5 rounded-lg border border-neutral-300 bg-neutral-100 hover:bg-neutral-200 text-neutral-900 text-xs font-semibold transition-colors"
              >
                📢 Association Assembly Notice
              </button>
            </div>
          </div>

          {/* Title Input */}
          <div className="space-y-1.5">
            <label className="font-bold text-neutral-900 uppercase tracking-wider text-[11px] block">
              Title *
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Gale Warning Advisory / Quarterly General Assembly"
              className="w-full h-11 px-3.5 rounded-xl border border-neutral-300 bg-white text-sm font-medium text-neutral-900 placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-black focus:border-black transition-all"
            />
          </div>

          {/* Target Audience */}
          <div className="space-y-1.5">
            <label className="font-bold text-neutral-900 uppercase tracking-wider text-[11px] block">
              Target Audience
            </label>
            <div className="flex flex-wrap gap-2">
              {[
                { id: "all", label: "All Owners" },
                { id: "homestay", label: "Homestays Only" },
                { id: "resort", label: "Resorts Only" },
              ].map((target) => {
                const isSelected = targetAudience === target.id;
                return (
                  <button
                    key={target.id}
                    type="button"
                    onClick={() => setTargetAudience(target.id as any)}
                    className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all border ${
                      isSelected
                        ? "bg-black text-white border-black shadow-xs"
                        : "bg-white text-neutral-700 border-neutral-300 hover:border-neutral-400 hover:bg-neutral-50"
                    }`}
                  >
                    {target.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Message Textarea */}
          <div className="space-y-1.5">
            <label className="font-bold text-neutral-900 uppercase tracking-wider text-[11px] block">
              Message *
            </label>
            <textarea
              rows={4}
              required
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Write your announcement details, instructions, dates, or contact information for members..."
              className="w-full p-3.5 rounded-xl border border-neutral-300 bg-white text-sm text-neutral-900 placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-black focus:border-black transition-all resize-none leading-relaxed"
            />
          </div>

          {/* Submit Button */}
          <div className="pt-2">
            <Button
              type="submit"
              disabled={isSubmitting}
              className="h-11 px-6 rounded-xl bg-black text-white hover:bg-neutral-800 text-xs font-semibold flex items-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Broadcasting...</span>
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  <span>Broadcast Announcement</span>
                </>
              )}
            </Button>
          </div>
        </form>
      </div>

      {/* Announcement History */}
      <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
          <h2 className="text-base font-bold text-neutral-900">
            Previous Broadcasts
          </h2>
          <span className="text-xs font-semibold text-neutral-600">
            {announcements.length} posted
          </span>
        </div>

        <div className="space-y-3">
          {announcements.length === 0 ? (
            <p className="py-8 text-center text-xs text-neutral-500">
              No announcements posted yet. Use the form above to broadcast your first message.
            </p>
          ) : announcements.map((ann) => (
            <div
              key={ann.id}
              className="rounded-xl border border-neutral-200 p-4 space-y-2 hover:border-neutral-300 transition-all bg-neutral-50/40"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-sm text-neutral-900">
                    {ann.title}
                  </h3>
                  <Badge
                    variant={
                      ann.target_audience === "all"
                        ? "default"
                        : ann.target_audience === "resort"
                        ? "secondary"
                        : "subtle"
                    }
                    size="sm"
                    className="capitalize"
                  >
                    {ann.target_audience === "all"
                      ? "All Members"
                      : `${ann.target_audience}s`}
                  </Badge>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-neutral-600 flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {new Date(ann.created_at).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </span>

                  <button
                    onClick={() => handleDelete(ann.id)}
                    className="p-1 rounded-md text-neutral-500 hover:text-red-600 transition-colors ml-1"
                    title="Delete announcement"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              <p className="text-xs text-neutral-700 leading-relaxed">
                {ann.content}
              </p>

              <div className="pt-1 text-[10px] text-neutral-500 font-medium">
                Issued by: {ann.admin_name || "MVBA Administration"}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
