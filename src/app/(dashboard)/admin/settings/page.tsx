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
  convenienceFee: z
    .number()
    .min(80, "Fee must be at least ₱80")
    .max(120, "Fee cannot exceed ₱120"),
  adminGcashNumber: z
    .string()
    .regex(/^09\d{9}$/, "Must be an 11-digit number starting with 09 (e.g. 09171234567)"),
  adminGcashName: z
    .string()
    .min(2, "Name must be at least 2 characters long"),
});

export default function AdminSettingsPage() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const [isInitializing, setIsInitializing] = useState(true);

  const form = useForm<z.infer<typeof systemSettingsSchema>>({
    resolver: zodResolver(systemSettingsSchema),
    defaultValues: {
      commissionPercentage: 8.0,
      convenienceFee: 100.0,
      adminGcashNumber: "",
      adminGcashName: "",
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
        convenienceFee: Number(settingsData.convenience_fee || 100),
        adminGcashNumber: settingsData.admin_gcash_number,
        adminGcashName: settingsData.admin_gcash_name,
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
    <div className="p-6 max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-neutral-900 flex items-center gap-2">
          <Settings className="h-8 w-8 text-neutral-400" />
          System Settings
        </h1>
        <p className="text-neutral-500 mt-1">
          Manage global platform configurations such as commission rates and central payment methods.
        </p>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-neutral-400" />
          <p className="text-sm font-medium text-neutral-500">Loading settings...</p>
        </div>
      ) : isError ? (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6 flex flex-col items-center text-center">
            <p className="text-red-600 font-medium mb-4">Failed to load system settings.</p>
            <Button variant="outline" onClick={() => queryClient.invalidateQueries({ queryKey: ["system-settings"] })}>
              Try Again
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="shadow-xs border-neutral-200/60 overflow-hidden rounded-2xl">
          <div className="bg-neutral-50/50 px-6 py-4 border-b border-neutral-100">
            <CardTitle className="text-lg flex items-center gap-2">
              Financial Configuration
            </CardTitle>
            <CardDescription className="mt-1">
              Changes to commission will affect all new bookings. GCash details are shown to tourists for deposit payments.
            </CardDescription>
          </div>
          <CardContent className="p-6">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                
                <div className="grid gap-6 md:grid-cols-2">
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
                            The percentage cut the MVBA association takes from the total booking price.
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
                      MVBA GCash Account
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
                                placeholder="e.g. MVBA Association" 
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
                            Tourists will send their 20% deposit to this number.
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
