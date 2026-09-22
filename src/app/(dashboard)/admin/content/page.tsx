"use client";

import React, { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Loader2, Save, Plus, Trash2 } from "lucide-react";

export default function AdminContentPage() {
  const [activeTab, setActiveTab] = useState<"explore" | "helpline">("explore");
  const supabase = createClient();

  // Settings State
  const [helpline, setHelpline] = useState({ phone: "", description: "" });
  const [isSavingHelpline, setIsSavingHelpline] = useState(false);
  const [isLoadingHelpline, setIsLoadingHelpline] = useState(true);

  // Explore State
  const [islands, setIslands] = useState<any[]>([]);
  const [isLoadingIslands, setIsLoadingIslands] = useState(true);

  useEffect(() => {
    fetchHelpline();
    fetchIslands();
  }, []);

  async function fetchHelpline() {
    try {
      const { data, error } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "helpline")
        .maybeSingle();

      if ((data as any)?.value) {
        setHelpline((data as any).value);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoadingHelpline(false);
    }
  }

  async function fetchIslands() {
    try {
      const { data, error } = await supabase
        .from("explore_islands")
        .select("*")
        .order("display_order", { ascending: true });

      if (data) {
        setIslands(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoadingIslands(false);
    }
  }

  async function handleSaveHelpline() {
    setIsSavingHelpline(true);
    try {
      const { error } = await supabase.from("app_settings").upsert(
        { key: "helpline", value: helpline } as any,
        { onConflict: "key" }
      );

      if (error) throw error;
      toast.success("Helpline settings saved!");
    } catch (error: any) {
      toast.error(error.message || "Failed to save settings");
    } finally {
      setIsSavingHelpline(false);
    }
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-neutral-900">
          Content Management
        </h1>
        <p className="text-sm text-neutral-500 mt-1">
          Manage dynamic content shown to tourists across the application.
        </p>
      </div>

      <div className="flex border-b border-neutral-200">
        <button
          onClick={() => setActiveTab("explore")}
          className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "explore"
              ? "border-black text-black"
              : "border-transparent text-neutral-500 hover:text-neutral-800"
          }`}
        >
          Explore Islands
        </button>
        <button
          onClick={() => setActiveTab("helpline")}
          className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "helpline"
              ? "border-black text-black"
              : "border-transparent text-neutral-500 hover:text-neutral-800"
          }`}
        >
          Emergency Helpline
        </button>
      </div>

      {activeTab === "explore" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Manage Islands</h2>
            <Button
              size="sm"
              className="bg-black text-white hover:bg-neutral-800"
            >
              <Plus className="w-4 h-4 mr-2" /> Add Island
            </Button>
          </div>
          
          <div className="bg-blue-50 text-blue-800 p-4 rounded-lg text-sm border border-blue-100">
            <strong>Note:</strong> Please run the database migration before using this feature. If no islands are loading, the table might not exist yet.
          </div>

          {isLoadingIslands ? (
            <div className="flex justify-center p-8">
              <Loader2 className="h-6 w-6 animate-spin text-neutral-400" />
            </div>
          ) : (
            <div className="grid gap-4">
              {islands.map((island) => (
                <div key={island.id} className="p-4 bg-white border rounded-lg flex items-center justify-between shadow-sm">
                  <div className="flex items-center gap-4">
                    <img src={island.image_url} alt={island.name} className="w-16 h-16 object-cover rounded-md" />
                    <div>
                      <h3 className="font-semibold text-neutral-900">{island.name}</h3>
                      <p className="text-sm text-neutral-500">{island.tagline}</p>
                    </div>
                  </div>
                  <Button variant="outline" size="sm">Edit</Button>
                </div>
              ))}
              {islands.length === 0 && (
                <p className="text-center text-neutral-500 py-8 border rounded-lg border-dashed">No islands found. Add one or run the migration.</p>
              )}
            </div>
          )}
        </div>
      )}

      {activeTab === "helpline" && (
        <div className="space-y-6 max-w-2xl bg-white p-6 rounded-xl border border-neutral-200 shadow-sm">
          <div>
            <h2 className="text-lg font-semibold">Emergency Helpline</h2>
            <p className="text-sm text-neutral-500">
              Shown in the tourist Profile tab for urgent assistance.
            </p>
          </div>

          {isLoadingHelpline ? (
            <div className="flex justify-center p-8">
              <Loader2 className="h-6 w-6 animate-spin text-neutral-400" />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Phone Number</label>
                <Input
                  value={helpline.phone}
                  onChange={(e) =>
                    setHelpline({ ...helpline, phone: e.target.value })
                  }
                  placeholder="(+63) 912-345-6789"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Description</label>
                <textarea
                  value={helpline.description}
                  onChange={(e: any) =>
                    setHelpline({ ...helpline, description: e.target.value })
                  }
                  className="min-h-[100px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  rows={4}
                />
              </div>
              <Button
                onClick={handleSaveHelpline}
                disabled={isSavingHelpline}
                className="bg-black text-white hover:bg-neutral-800"
              >
                {isSavingHelpline && (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                )}
                Save Settings
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
