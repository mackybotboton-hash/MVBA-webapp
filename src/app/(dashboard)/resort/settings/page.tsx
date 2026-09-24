"use client";

import { useState, useTransition, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Store, Wallet, Bell, Save, Loader2, Check, Shield, Lock, Mail, X } from "lucide-react";
import { updatePayoutMethod, updateNotificationPreferences, updateAccountPasswordAction } from "@/app/actions/settings-actions";
import { useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

export default function ResortSettingsPage() {
  const queryClient = useQueryClient();
  const [isPendingPayout, startTransitionPayout] = useTransition();
  const [isPendingNotifications, startTransitionNotifications] = useTransition();
  const [payoutNumber, setPayoutNumber] = useState("");
  const [isSaved, setIsSaved] = useState(false);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isPendingPassword, startTransitionPassword] = useTransition();

  const [userEmail, setUserEmail] = useState("");
  const [isVerified, setIsVerified] = useState(false);
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);

  useEffect(() => {
    async function loadProfile() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserEmail(user.email || "");
        const { data } = await supabase
          .from("profiles")
          .select("payout_gcash_number")
          .eq("id", user.id)
          .single();
        const profile = data as { payout_gcash_number?: string } | null;
        if (profile?.payout_gcash_number) {
          setPayoutNumber(profile.payout_gcash_number);
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

  const handleUpdatePassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      toast.error("Password must be at least 8 characters long.");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }
    startTransitionPassword(async () => {
      const res = await updateAccountPasswordAction(newPassword);
      if (res.success) {
        toast.success("Account password changed successfully.");
        setNewPassword("");
        setConfirmPassword("");
      } else {
        toast.error(res.error || "Failed to change password.");
      }
    });
  };

  const handleSendOtp = async () => {
    if (!userEmail) return;
    setIsSendingOtp(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({ email: userEmail });
    if (error) {
      toast.error(error.message || "Failed to send code.");
    } else {
      toast.success("Verification code sent to your email!");
      setShowOtpModal(true);
    }
    setIsSendingOtp(false);
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otpCode.length < 6) {
      toast.error("Please enter the 6-digit code.");
      return;
    }
    setIsVerifyingOtp(true);
    const supabase = createClient();
    const { error } = await supabase.auth.verifyOtp({
      email: userEmail,
      token: otpCode,
      type: "email",
    });

    if (error) {
      toast.error(error.message || "Invalid or expired code.");
    } else {
      toast.success("Identity verified successfully.");
      setIsVerified(true);
      setShowOtpModal(false);
    }
    setIsVerifyingOtp(false);
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
              {!isVerified ? (
                <div className="p-4 rounded-xl border border-amber-200 bg-amber-50 flex items-start sm:items-center justify-between flex-col sm:flex-row gap-4">
                  <div className="flex items-center gap-3">
                    <Lock className="h-5 w-5 text-amber-600 shrink-0" />
                    <div className="space-y-0.5">
                      <p className="text-sm font-semibold text-amber-900">Security Verification Required</p>
                      <p className="text-xs text-amber-700">Please verify your identity to view or modify your payout details.</p>
                    </div>
                  </div>
                  <Button type="button" onClick={handleSendOtp} disabled={isSendingOtp || !userEmail} className="bg-amber-600 hover:bg-amber-700 text-white shrink-0" size="sm">
                    {isSendingOtp ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Mail className="h-4 w-4 mr-2" />}
                    Send Code
                  </Button>
                </div>
              ) : (
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
              )}
            </CardContent>
            <CardFooter className="border-t bg-neutral-50/50 px-6 py-4">
              <Button 
                type="submit" 
                disabled={!isVerified || isPendingPayout || isLoadingProfile} 
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

        {/* Account Security */}
        <Card>
          <form onSubmit={handleUpdatePassword}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-neutral-500" />
                Account Security
              </CardTitle>
              <CardDescription>
                Manage your login credentials and secure your host account.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!isVerified ? (
                <div className="p-4 rounded-xl border border-amber-200 bg-amber-50 flex items-start sm:items-center justify-between flex-col sm:flex-row gap-4">
                  <div className="flex items-center gap-3">
                    <Lock className="h-5 w-5 text-amber-600 shrink-0" />
                    <div className="space-y-0.5">
                      <p className="text-sm font-semibold text-amber-900">Security Verification Required</p>
                      <p className="text-xs text-amber-700">Please verify your identity to modify your account password.</p>
                    </div>
                  </div>
                  <Button type="button" onClick={handleSendOtp} disabled={isSendingOtp || !userEmail} className="bg-amber-600 hover:bg-amber-700 text-white shrink-0" size="sm">
                    {isSendingOtp ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Mail className="h-4 w-4 mr-2" />}
                    Send Code
                  </Button>
                </div>
              ) : (
                <>
                  <div className="space-y-2 max-w-md">
                    <Label htmlFor="new-password">New Password</Label>
                    <Input 
                      id="new-password" 
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="••••••••" 
                      minLength={8}
                    />
                  </div>
                  <div className="space-y-2 max-w-md">
                    <Label htmlFor="confirm-password">Confirm New Password</Label>
                    <Input 
                      id="confirm-password" 
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••" 
                      minLength={8}
                    />
                  </div>
                </>
              )}
            </CardContent>
            <CardFooter className="border-t bg-neutral-50/50 px-6 py-4">
              <Button type="submit" disabled={!isVerified || isPendingPassword || !newPassword} size="sm">
                {isPendingPassword ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Change Password
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>

      {showOtpModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-neutral-900">Verify Identity</h3>
              <button onClick={() => setShowOtpModal(false)} className="text-neutral-400 hover:text-neutral-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="text-sm text-neutral-600 mb-6">
              We&apos;ve sent a 6-digit code to <span className="font-semibold text-neutral-900">{userEmail}</span>. Enter it below to unlock sensitive settings.
            </p>
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div className="space-y-2">
                <Label>Verification Code</Label>
                <Input 
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value)}
                  placeholder="000000"
                  maxLength={6}
                  className="text-center tracking-widest text-lg font-mono"
                  required
                />
              </div>
              <Button type="submit" className="w-full bg-black text-white hover:bg-neutral-800" disabled={isVerifyingOtp || otpCode.length < 6}>
                {isVerifyingOtp ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                Verify & Unlock
              </Button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
