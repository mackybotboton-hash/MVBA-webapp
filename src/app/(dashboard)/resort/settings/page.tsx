"use client";

import { useState, useTransition, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Store, Wallet, Bell, Save, Loader2, Check } from "lucide-react";
import { updatePayoutMethod, updateNotificationPreferences } from "@/app/actions/settings-actions";
import { useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

export default function ResortSettingsPage() {
  const queryClient = useQueryClient();
  const [isPendingPayout, startTransitionPayout] = useTransition();
  const [isPendingNotifications, startTransitionNotifications] = useTransition();
  const [payoutNumber, setPayoutNumber] = useState("");
  const [isSaved, setIsSaved] = useState(false);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);

  useEffect(() => {
    async function loadProfile() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase
          .from("profiles")
          .select("payout_gcash_number")
          .eq("id", user.id)
          .single();
        if (data?.payout_gcash_number) {
          setPayoutNumber(data.payout_gcash_number);
        }
      }
      setIsLoadingProfile(false);
    }
    loadProfile();
  }, []);

  const handleSavePayout = (formData: FormData) => {
    startTransitionPayout(async () => {
      const result = await updatePayoutMethod(formData);
      if (result.success) {
        toast.success("Payout method saved successfully.");
        queryClient.invalidateQueries({ queryKey: ['profile-settings'] });
        setIsSaved(true);
        setTimeout(() => setIsSaved(false), 1000);
      } else {
        toast.error(result.error || "Failed to save payout method.");
      }
    });
  };

  const handlePushToggle = (checked: boolean) => {
    startTransitionNotifications(async () => {
      const result = await updateNotificationPreferences(checked);
      if (result.success) {
        toast.success(`Push notifications ${checked ? 'enabled' : 'disabled'}.`);
        queryClient.invalidateQueries({ queryKey: ['profile-settings'] });
      } else {
        toast.error(result.error || "Failed to update notification preferences.");
      }
    });
  };

  return (
    <div className="space-y-6 max-w-4xl pb-10">
      <div className="border-b border-neutral-200 pb-5">
        <h1 className="text-2xl font-bold text-neutral-900 tracking-tight">Resort Settings</h1>
        <p className="text-sm text-neutral-600 mt-1">
          Manage your business details, payout methods, and notifications.
        </p>
      </div>

      <div className="space-y-8">
        {/* Business Details */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Store className="h-5 w-5 text-neutral-500" />
              Business Details
            </CardTitle>
            <CardDescription>
              Your legal business information used for tax and registration purposes.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="legal-name">Legal Business Name</Label>
                <Input id="legal-name" placeholder="e.g. Islavida Beach Resort" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tin">TIN (Tax Identification Number)</Label>
                <Input id="tin" placeholder="000-000-000-000" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dti">DTI Registration Number</Label>
                <Input id="dti" placeholder="DTI Registration No." />
              </div>
              <div className="space-y-2">
                <Label htmlFor="status">Operating Status</Label>
                <select id="status" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50">
                  <option value="active">Active (Accepting Bookings)</option>
                  <option value="inactive">Inactive (Temporarily Closed)</option>
                </select>
              </div>
            </div>
          </CardContent>
          <CardFooter className="border-t bg-neutral-50/50 px-6 py-4">
            <Button size="sm" onClick={() => toast.success("Business details saved (mock)")}>
              <Save className="h-4 w-4 mr-2" />
              Save Business Details
            </Button>
          </CardFooter>
        </Card>

        {/* Payout Methods */}
        <Card>
          <form action={handleSavePayout}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wallet className="h-5 w-5 text-neutral-500" />
                Payout Methods
              </CardTitle>
              <CardDescription>
                Where we will send your earnings and the 12% admin-forwarded deposits.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2 max-w-md">
                <Label htmlFor="gcash-number">GCash Receiving Number</Label>
                <Input 
                  id="gcash-number" 
                  name="gcashNumber" 
                  value={payoutNumber}
                  onChange={(e) => setPayoutNumber(e.target.value)}
                  disabled={isLoadingProfile}
                  placeholder="09123456789" 
                  required 
                  pattern="^09\d{9}$" 
                  title="Must be exactly 11 digits starting with 09" 
                />
                <p className="text-xs text-neutral-500 mt-1">
                  Must be a fully verified GCash account to receive deposits.
                </p>
              </div>
            </CardContent>
            <CardFooter className="border-t bg-neutral-50/50 px-6 py-4">
              <Button 
                type="submit" 
                disabled={isPendingPayout || isLoadingProfile} 
                size="sm"
                className={isSaved ? "bg-emerald-600 hover:bg-emerald-700 text-white" : ""}
              >
                {isPendingPayout ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : isSaved ? (
                  <Check className="h-4 w-4 mr-2" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                {isSaved ? "Saved" : "Save Payout Method"}
              </Button>
            </CardFooter>
          </form>
        </Card>

        {/* Notification Preferences */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-neutral-500" />
              Notification Preferences
            </CardTitle>
            <CardDescription>
              Control how you receive alerts for new bookings and messages.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-base">Push Notifications</Label>
                <p className="text-sm text-neutral-500">
                  Receive browser web push alerts for new reservations.
                </p>
              </div>
              <Switch 
                defaultChecked 
                onCheckedChange={handlePushToggle} 
                disabled={isPendingNotifications} 
              />
            </div>
            <div className="flex items-center justify-between opacity-50 pointer-events-none">
              <div className="space-y-0.5">
                <Label className="text-base">Email Alerts</Label>
                <p className="text-sm text-neutral-500">
                  Daily summaries and important system announcements.
                </p>
              </div>
              <Switch defaultChecked />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
