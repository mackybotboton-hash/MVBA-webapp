"use client";

import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { getSystemSettings, updateSystemSettings } from "@/app/actions/admin-settings-actions";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Settings, Save, Percent, Phone, User } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

const systemSettingsSchema = z.object({
  commissionPercentage: z
    .number()
    .min(0, "Must be at least 0%")
    .max(100, "Cannot exceed 100%"),
  addonCommissionPercentage: z
    .number()
    .min(0, "Must be at least 0%")
    .max(100, "Cannot exceed 100%"),
  convenienceFee: z
    .number()
    .min(80, "Fee must be at least ₱80")
    .max(120, "Fee cannot exceed ₱120"),
  minDownpaymentPercent: z
    .number()
    .min(1, "Must be at least 1%")
    .max(100, "Cannot exceed 100%"),
  adminGcashNumber: z
    .string()
    .regex(/^09\d{9}$/, "Must be an 11-digit number starting with 09 (e.g. 09171234567)"),
  adminGcashName: z
    .string()
    .min(2, "Name must be at least 2 characters long"),
  // Cancellation and Refund Policy
  refundFullDays: z
    .number()
    .int()
    .min(1, "Full refund days must be at least 1")
    .max(30, "Cannot exceed 30 days"),
  refundPartialDays: z
    .number()
    .int()
    .min(0, "Partial refund days must be at least 0")
    .max(30, "Cannot exceed 30 days"),
  refundPartialPercent: z
    .number()
    .min(0, "Must be at least 0%")
    .max(100, "Cannot exceed 100%"),
  convenienceFeeRefundRule: z.enum(["never", "full_tier_only", "always"]),
  hostRefundDeadlineHours: z
    .number()
    .int()
    .min(1, "Deadline must be at least 1 hour")
    .max(168, "Cannot exceed 168 hours"),
}).refine((data) => data.refundFullDays > data.refundPartialDays, {
  message: "Full refund window (days) must be greater than partial refund window (days).",
  path: ["refundFullDays"],
});

export default function AdminSettingsPage() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const [isInitializing, setIsInitializing] = useState(true);

  const form = useForm<z.infer<typeof systemSettingsSchema>>({
    resolver: zodResolver(systemSettingsSchema),
    defaultValues: {
      commissionPercentage: 8.0,
      addonCommissionPercentage: 8.0,
      minDownpaymentPercent: 20,
      convenienceFee: 100.0,
      adminGcashNumber: "",
      adminGcashName: "",
      refundFullDays: 7,
      refundPartialDays: 3,
      refundPartialPercent: 50,
      convenienceFeeRefundRule: "never",
      hostRefundDeadlineHours: 72,
    },
  });

  const { data: settingsData, isLoading: isLoadingQuery, isError } = useQuery({
    queryKey: ["system-settings"],
    queryFn: async () => {
      const result = await getSystemSettings();
      if (!result.success || !result.settings) {
        throw new Error(result.error || "Failed to fetch settings");
      }
      return result.settings;
    },
  });

  useEffect(() => {
    if (settingsData) {
      form.reset({
        commissionPercentage: Number(settingsData.commission_percentage),
        addonCommissionPercentage: Number(settingsData.addon_commission_percentage || 8.0),
        minDownpaymentPercent: Number(settingsData.min_downpayment_percent || 20),
        convenienceFee: Number(settingsData.convenience_fee || 100),
        adminGcashNumber: settingsData.admin_gcash_number,
        adminGcashName: settingsData.admin_gcash_name,
        refundFullDays: Number(settingsData.refund_full_days ?? 7),
        refundPartialDays: Number(settingsData.refund_partial_days ?? 3),
        refundPartialPercent: Number(settingsData.refund_partial_percent ?? 50),
        convenienceFeeRefundRule: settingsData.convenience_fee_refund_rule ?? "never",
        hostRefundDeadlineHours: Number(settingsData.host_refund_deadline_hours ?? 72),
      });
      setIsInitializing(false);
    }
  }, [settingsData, form]);

  const updateMutation = useMutation({
    mutationFn: async (values: z.infer<typeof systemSettingsSchema>) => {
      const result = await updateSystemSettings(values);
      if (!result.success) {
        throw new Error(result.error);
      }
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["system-settings"] });
      toast.success("System settings updated successfully");
      router.refresh();
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to update settings");
    },
  });

  function onSubmit(values: z.infer<typeof systemSettingsSchema>) {
    updateMutation.mutate(values);
  }

  const isLoading = isLoadingQuery || isInitializing;

  return (
    <div className="max-w-4xl space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-neutral-900 flex items-center gap-2">
          <Settings className="h-6 w-6 text-neutral-400" />
          System Settings
        </h1>
        <p className="text-xs sm:text-sm text-neutral-500 mt-0.5">
          Manage global platform configurations such as commission rates and central payment methods.
        </p>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-16 space-y-3">
          <Loader2 className="h-7 w-7 animate-spin text-neutral-400" />
          <p className="text-xs font-medium text-neutral-500">Loading settings...</p>
        </div>
      ) : isError ? (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-5 flex flex-col items-center text-center">
            <p className="text-red-600 font-medium mb-3">Failed to load system settings.</p>
            <Button variant="outline" onClick={() => queryClient.invalidateQueries({ queryKey: ["system-settings"] })}>
              Try Again
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="shadow-2xs border-neutral-200/60 overflow-hidden rounded-2xl">
          <div className="bg-neutral-50/50 px-4 sm:px-5 py-3.5 border-b border-neutral-100">
            <CardTitle className="text-base flex items-center gap-2">
              Financial Configuration
            </CardTitle>
            <CardDescription className="mt-0.5 text-xs">
              Changes to commission will affect all new bookings. GCash details are shown to tourists for deposit payments.
            </CardDescription>
          </div>
          <CardContent className="p-4 sm:p-5">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                
                <div className="grid gap-4 sm:gap-5 md:grid-cols-2">
                  <div className="space-y-6">
                    <h3 className="font-semibold text-sm text-neutral-900 flex items-center gap-2 border-b pb-2">
                      <Percent className="h-4 w-4 text-emerald-600" />
                      Platform Fees
                    </h3>
                    
                    <FormField
                      control={form.control}
                      name="commissionPercentage"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="font-semibold">Commission Percentage (%)</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Input 
                                type="number" 
                                step="0.1" 
                                placeholder="8.0" 
                                className="pl-9 h-11 bg-neutral-50 focus-visible:ring-emerald-500"
                                {...field} 
                                onChange={(e) => field.onChange(e.target.value === "" ? "" : Number(e.target.value))}
                              />
                              <Percent className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
                            </div>
                          </FormControl>
                          <FormDescription>
                            The percentage cut the Panaw platform takes from the total booking price.
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="addonCommissionPercentage"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="font-semibold">Add-on Commission (%)</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Input 
                                type="number" 
                                step="0.1" 
                                placeholder="8.0" 
                                className="pl-9 h-11 bg-neutral-50 focus-visible:ring-emerald-500"
                                {...field} 
                                onChange={(e) => field.onChange(e.target.value === "" ? "" : Number(e.target.value))}
                              />
                              <Percent className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
                            </div>
                          </FormControl>
                          <FormDescription>
                            The percentage cut the Panaw platform takes from extra services (e.g., Island Hopping).
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="minDownpaymentPercent"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="font-semibold">Global Minimum Deposit (%)</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Input 
                                type="number" 
                                step="1" 
                                placeholder="20" 
                                className="pl-9 h-11 bg-neutral-50 focus-visible:ring-emerald-500"
                                {...field} 
                                onChange={(e) => field.onChange(e.target.value === "" ? "" : Number(e.target.value))}
                              />
                              <Percent className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
                            </div>
                          </FormControl>
                          <FormDescription>
                            The absolute minimum deposit percentage required to secure a booking.
                            <br/><span className="text-amber-600 font-medium">Note: The effective minimum will automatically never be lower than your highest commission rate.</span>
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="convenienceFee"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="font-semibold">Guest Convenience Fee (₱)</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Input 
                                type="number" 
                                step="1" 
                                placeholder="100" 
                                className="pl-9 h-11 bg-neutral-50 focus-visible:ring-emerald-500"
                                {...field} 
                                onChange={(e) => field.onChange(e.target.value === "" ? "" : Number(e.target.value))}
                              />
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 font-bold">₱</span>
                            </div>
                          </FormControl>
                          <FormDescription>
                            Flat fee charged to the tourist at checkout (₱80–120). Goes entirely to the platform.
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="space-y-6">
                    <h3 className="font-semibold text-sm text-neutral-900 flex items-center gap-2 border-b pb-2">
                      <Phone className="h-4 w-4 text-blue-600" />
                      Panaw GCash Account
                    </h3>

                    <FormField
                      control={form.control}
                      name="adminGcashName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="font-semibold">Account Name</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Input 
                                placeholder="e.g. Panaw" 
                                className="pl-9 h-11 bg-neutral-50 focus-visible:ring-blue-500"
                                {...field} 
                              />
                              <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
                            </div>
                          </FormControl>
                          <FormDescription>
                            The registered name of the association&apos;s GCash account.
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="adminGcashNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="font-semibold">GCash Mobile Number</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Input 
                                placeholder="09170000000" 
                                className="pl-9 h-11 bg-neutral-50 focus-visible:ring-blue-500 font-mono"
                                {...field} 
                              />
                              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
                            </div>
                          </FormControl>
                          <FormDescription>
                            Tourists will send their required deposit to this number.
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                {/* Cancellation & Refund Rules Configuration */}
                <div className="pt-6 border-t border-neutral-200">
                  <h3 className="font-semibold text-sm text-neutral-900 flex items-center gap-2 mb-4">
                    <Settings className="h-4 w-4 text-amber-600" />
                    Cancellation &amp; Refund Policy Defaults
                  </h3>

                  <div className="grid gap-6 md:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="refundFullDays"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="font-semibold">Full Refund Window (Days Before Check-in)</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              step="1" 
                              min="1"
                              max="30"
                              placeholder="7" 
                              className="h-11 bg-neutral-50 focus-visible:ring-amber-500"
                              {...field} 
                              onChange={(e) => field.onChange(e.target.value === "" ? "" : Number(e.target.value))}
                            />
                          </FormControl>
                          <FormDescription>
                            Minimum calendar days required before check-in for a 100% deposit refund (Standard Policy).
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="refundPartialDays"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="font-semibold">Partial Refund Cutoff (Days Before Check-in)</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              step="1" 
                              min="0"
                              max="30"
                              placeholder="3" 
                              className="h-11 bg-neutral-50 focus-visible:ring-amber-500"
                              {...field} 
                              onChange={(e) => field.onChange(e.target.value === "" ? "" : Number(e.target.value))}
                            />
                          </FormControl>
                          <FormDescription>
                            Notice cutoff below which bookings become strictly non-refundable (e.g. 3 days).
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="refundPartialPercent"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="font-semibold">Partial Refund Percentage (%)</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Input 
                                type="number" 
                                step="1" 
                                min="0"
                                max="100"
                                placeholder="50" 
                                className="pl-9 h-11 bg-neutral-50 focus-visible:ring-amber-500"
                                {...field} 
                                onChange={(e) => field.onChange(e.target.value === "" ? "" : Number(e.target.value))}
                              />
                              <Percent className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
                            </div>
                          </FormControl>
                          <FormDescription>
                            Deposit percentage refunded when cancelled within the partial window (Standard Policy).
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="convenienceFeeRefundRule"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="font-semibold">Booking Convenience Fee Refund Rule</FormLabel>
                          <FormControl>
                            <select
                              className="w-full h-11 px-3 rounded-lg border border-neutral-300 text-sm focus:outline-none focus:ring-1 focus:ring-black bg-neutral-50"
                              {...field}
                            >
                              <option value="never">Never (Platform Retains Fee - Default)</option>
                              <option value="full_tier_only">Full Tier Only (Refund with 100% deposit tier)</option>
                              <option value="always">Always (Refund on every cancellation)</option>
                            </select>
                          </FormControl>
                          <FormDescription>
                            Controls whether the ₱100 convenience fee is returned to tourists upon guest cancellation.
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="hostRefundDeadlineHours"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="font-semibold">Host Refund Deadline (Hours)</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              step="1" 
                              min="1"
                              max="168"
                              placeholder="72" 
                              className="h-11 bg-neutral-50 focus-visible:ring-amber-500"
                              {...field} 
                              onChange={(e) => field.onChange(e.target.value === "" ? "" : Number(e.target.value))}
                            />
                          </FormControl>
                          <FormDescription>
                            Deadline for hosts to upload GCash proof for host-leg refunds (default 72h).
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-6 border-t border-neutral-100">
                  <Button 
                    type="submit" 
                    disabled={updateMutation.isPending || !form.formState.isDirty}
                    className="h-11 px-8 rounded-xl bg-black text-white hover:bg-neutral-800 shadow-sm"
                  >
                    {updateMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Saving Changes...
                      </>
                    ) : (
                      <>
                        <Save className="mr-2 h-4 w-4" />
                        Save Configuration
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
