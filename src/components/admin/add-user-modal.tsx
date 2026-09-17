"use client";

import * as React from "react";
import { useState } from "react";
import { X, UserPlus, Loader2, Building2, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { createOwnerAccount } from "@/app/actions/admin-actions";

export function AddUserModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsLoading(true);

    const formData = new FormData(e.currentTarget);
    const result = await createOwnerAccount(formData);

    setIsLoading(false);

    if (result.success) {
      toast.success("User created successfully!");
      onClose();
    } else {
      toast.error(result.error || "Failed to create user");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" 
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div className="flex flex-col p-6 sm:p-8">
          <div className="flex items-start justify-between mb-6">
            <div>
              <h2 className="text-xl font-bold text-neutral-900 tracking-tight">Add New Owner</h2>
              <p className="text-sm text-neutral-600 mt-1">Create an account for a Homestay or Resort owner.</p>
            </div>
            <button
              onClick={onClose}
              className="rounded-full p-2 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-neutral-700">Full Name</label>
              <Input
                name="fullName"
                required
                placeholder="Juan Dela Cruz"
                className="h-10 rounded-xl border-neutral-300 focus-visible:ring-black"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-neutral-700">Email Address</label>
              <Input
                name="email"
                type="email"
                required
                placeholder="owner@example.com"
                className="h-10 rounded-xl border-neutral-300 focus-visible:ring-black"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-neutral-700">Password</label>
              <Input
                name="password"
                type="password"
                required
                minLength={6}
                placeholder="Min. 6 characters"
                className="h-10 rounded-xl border-neutral-300 focus-visible:ring-black"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-neutral-700">Role</label>
              <div className="grid grid-cols-2 gap-2">
                <label className="flex items-center gap-2 rounded-xl border border-neutral-200 p-3 cursor-pointer hover:bg-neutral-50 has-[:checked]:border-black has-[:checked]:bg-black/5 transition-colors">
                  <input type="radio" name="role" value="homestay" defaultChecked className="hidden" />
                  <Home className="h-4 w-4 text-neutral-600" />
                  <span className="text-sm font-medium">Homestay Host</span>
                </label>
                <label className="flex items-center gap-2 rounded-xl border border-neutral-200 p-3 cursor-pointer hover:bg-neutral-50 has-[:checked]:border-black has-[:checked]:bg-black/5 transition-colors">
                  <input type="radio" name="role" value="resort" className="hidden" />
                  <Building2 className="h-4 w-4 text-neutral-600" />
                  <span className="text-sm font-medium">Resort Owner</span>
                </label>
              </div>
            </div>

            <div className="pt-4">
              <Button
                type="submit"
                disabled={isLoading}
                className="w-full h-11 rounded-xl bg-black text-white hover:bg-neutral-800"
              >
                {isLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <>
                    <UserPlus className="h-4 w-4 mr-2" />
                    Create Account
                  </>
                )}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
