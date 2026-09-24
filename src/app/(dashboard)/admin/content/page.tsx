"use client";

import React, { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Loader2, Save, Plus, Trash2 } from "lucide-react";

export default function AdminContentPage() {
  const [activeTab, setActiveTab] = useState<"explore" | "hotlines">("explore");
  const supabase = createClient();

  // Hotlines State
  const [hotlines, setHotlines] = useState<any[]>([]);
  const [isLoadingHotlines, setIsLoadingHotlines] = useState(true);
  const [editingHotline, setEditingHotline] = useState<any | null>(null);
  const [isSavingHotline, setIsSavingHotline] = useState(false);

  // Explore State
  const [islands, setIslands] = useState<any[]>([]);
  const [isLoadingIslands, setIsLoadingIslands] = useState(true);
  const [editingIsland, setEditingIsland] = useState<any | null>(null);
  const [isSavingIsland, setIsSavingIsland] = useState(false);

  const fetchHotlines = useCallback(async () => {
    try {
      const { data } = await supabase
        .from("system_hotlines")
        .select("*")
        .order("display_order", { ascending: true });

      if (data) {
        setHotlines(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoadingHotlines(false);
    }
  }, [supabase]);

  const fetchIslands = useCallback(async () => {
    try {
      const { data } = await supabase
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
  }, [supabase]);

  useEffect(() => {
    fetchHotlines();
    fetchIslands();
  }, [fetchHotlines, fetchIslands]);

  async function handleSaveHotline(e: React.FormEvent) {
    e.preventDefault();
    if (!editingHotline) return;
    setIsSavingHotline(true);
    try {
      if (editingHotline.id === "new") {
        const { error } = await supabase.from("system_hotlines").insert({
          name: editingHotline.name,
          description: editingHotline.description,
          number: editingHotline.number,
          display_order: editingHotline.display_order || 0,
        } as any);
        if (error) throw error;
        toast.success("Hotline created!");
      } else {
        const { error } = await supabase.from("system_hotlines").update({
          name: editingHotline.name,
          description: editingHotline.description,
          number: editingHotline.number,
          display_order: editingHotline.display_order,
        } as any).eq("id", editingHotline.id);
        if (error) throw error;
        toast.success("Hotline updated!");
      }
      setEditingHotline(null);
      fetchHotlines();
    } catch (error: any) {
      toast.error(error.message || "Failed to save hotline");
    } finally {
      setIsSavingHotline(false);
    }
  }

  async function handleDeleteHotline(id: string) {
    if (!window.confirm("Are you sure you want to delete this hotline?")) return;
    try {
      const { error } = await supabase.from("system_hotlines").delete().eq("id", id);
      if (error) throw error;
      toast.success("Hotline deleted");
      fetchHotlines();
    } catch (error: any) {
      toast.error(error.message || "Failed to delete");
    }
  }

  async function handleSaveIsland(e: React.FormEvent) {
    e.preventDefault();
    if (!editingIsland) return;
    setIsSavingIsland(true);
    try {
      if (editingIsland.id === "new") {
        const { error } = await supabase.from("explore_islands").insert({
          name: editingIsland.name,
          tagline: editingIsland.tagline,
          description: editingIsland.description,
          image_url: editingIsland.image_url,
          display_order: editingIsland.display_order || 0,
        } as any);
        if (error) throw error;
        toast.success("Island added!");
      } else {
        const { error } = await supabase.from("explore_islands").update({
          name: editingIsland.name,
          tagline: editingIsland.tagline,
          description: editingIsland.description,
          image_url: editingIsland.image_url,
          display_order: editingIsland.display_order,
        } as any).eq("id", editingIsland.id);
        if (error) throw error;
        toast.success("Island updated!");
      }
      setEditingIsland(null);
      fetchIslands();
    } catch (error: any) {
      toast.error(error.message || "Failed to save island");
    } finally {
      setIsSavingIsland(false);
    }
  }

  async function handleDeleteIsland(id: string) {
    if (!window.confirm("Are you sure you want to delete this island?")) return;
    try {
      const { error } = await supabase.from("explore_islands").delete().eq("id", id);
      if (error) throw error;
      toast.success("Island deleted");
      fetchIslands();
    } catch (error: any) {
      toast.error(error.message || "Failed to delete");
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
          onClick={() => setActiveTab("hotlines")}
          className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "hotlines"
              ? "border-black text-black"
              : "border-transparent text-neutral-500 hover:text-neutral-800"
          }`}
        >
          Emergency Hotlines
        </button>
      </div>

      {activeTab === "explore" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Manage Islands</h2>
            <Button
              onClick={() => setEditingIsland({ id: "new", name: "", tagline: "", description: "", image_url: "", display_order: islands.length + 1 })}
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
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => setEditingIsland(island)}>Edit</Button>
                    <Button variant="outline" size="sm" onClick={() => handleDeleteIsland(island.id)} className="text-red-600 hover:text-red-700">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
              {islands.length === 0 && (
                <p className="text-center text-neutral-500 py-8 border rounded-lg border-dashed">No islands found. Add one or run the migration.</p>
              )}
            </div>
          )}
        </div>
      )}

      {editingIsland && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <form onSubmit={handleSaveIsland} className="w-full max-w-lg bg-white rounded-xl shadow-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold">{editingIsland.id === "new" ? "Add Island" : "Edit Island"}</h3>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Island Name</label>
              <Input required value={editingIsland.name} onChange={e => setEditingIsland({...editingIsland, name: e.target.value})} placeholder="e.g. Naked Island" />
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Tagline</label>
              <Input required value={editingIsland.tagline} onChange={e => setEditingIsland({...editingIsland, tagline: e.target.value})} placeholder="e.g. The Bare Beauty" />
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Description</label>
              <textarea 
                required 
                value={editingIsland.description} 
                onChange={e => setEditingIsland({...editingIsland, description: e.target.value})} 
                className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm min-h-[100px]" 
                placeholder="Detailed description..." 
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Image URL</label>
              <Input required value={editingIsland.image_url} onChange={e => setEditingIsland({...editingIsland, image_url: e.target.value})} placeholder="https://..." />
              {editingIsland.image_url && (
                <div className="mt-2 relative h-32 w-full rounded-md overflow-hidden bg-neutral-100">
                  <img src={editingIsland.image_url} alt="Preview" className="object-cover w-full h-full" />
                </div>
              )}
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Display Order</label>
              <Input type="number" required value={editingIsland.display_order} onChange={e => setEditingIsland({...editingIsland, display_order: parseInt(e.target.value) || 0})} />
            </div>

            <div className="flex items-center justify-end gap-2 pt-4">
              <Button type="button" variant="ghost" onClick={() => setEditingIsland(null)}>Cancel</Button>
              <Button type="submit" disabled={isSavingIsland} className="bg-black text-white hover:bg-neutral-800">
                {isSavingIsland ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                Save
              </Button>
            </div>
          </form>
        </div>
      )}

      {activeTab === "hotlines" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Emergency Hotlines</h2>
              <p className="text-sm text-neutral-500">
                Manage the emergency contact numbers shown in the tourist app.
              </p>
            </div>
            <Button
              onClick={() => setEditingHotline({ id: "new", name: "", description: "", number: "", display_order: hotlines.length + 1 })}
              size="sm"
              className="bg-black text-white hover:bg-neutral-800"
            >
              <Plus className="w-4 h-4 mr-2" /> Add Hotline
            </Button>
          </div>

          {isLoadingHotlines ? (
            <div className="flex justify-center p-8">
              <Loader2 className="h-6 w-6 animate-spin text-neutral-400" />
            </div>
          ) : (
            <div className="grid gap-4">
              {hotlines.map((hotline) => (
                <div key={hotline.id} className="p-4 bg-white border rounded-lg shadow-sm flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-neutral-900">{hotline.name}</h3>
                    <p className="text-sm font-bold text-emerald-700 mt-1">{hotline.number}</p>
                    <p className="text-xs text-neutral-500 mt-1">{hotline.description}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => setEditingHotline(hotline)}>Edit</Button>
                    <Button variant="outline" size="sm" onClick={() => handleDeleteHotline(hotline.id)} className="text-red-600 hover:text-red-700">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
              {hotlines.length === 0 && (
                <p className="text-center text-neutral-500 py-8 border rounded-lg border-dashed">No hotlines configured.</p>
              )}
            </div>
          )}

          {editingHotline && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
              <form onSubmit={handleSaveHotline} className="w-full max-w-md bg-white rounded-xl shadow-lg p-6 space-y-4">
                <h3 className="text-lg font-bold">{editingHotline.id === "new" ? "Add Hotline" : "Edit Hotline"}</h3>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium">Agency / Name</label>
                  <Input required value={editingHotline.name} onChange={e => setEditingHotline({...editingHotline, name: e.target.value})} placeholder="e.g. San Agustin MDRRMO" />
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium">Phone Number</label>
                  <Input required value={editingHotline.number} onChange={e => setEditingHotline({...editingHotline, number: e.target.value})} placeholder="0998..." />
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium">Description</label>
                  <Input value={editingHotline.description || ""} onChange={e => setEditingHotline({...editingHotline, description: e.target.value})} placeholder="e.g. 24/7 Sea rescue" />
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium">Display Order</label>
                  <Input type="number" required value={editingHotline.display_order} onChange={e => setEditingHotline({...editingHotline, display_order: parseInt(e.target.value) || 0})} />
                </div>

                <div className="flex items-center justify-end gap-2 pt-4">
                  <Button type="button" variant="ghost" onClick={() => setEditingHotline(null)}>Cancel</Button>
                  <Button type="submit" disabled={isSavingHotline} className="bg-black text-white hover:bg-neutral-800">
                    {isSavingHotline ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                    Save
                  </Button>
                </div>
              </form>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
