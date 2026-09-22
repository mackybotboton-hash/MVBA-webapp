"use client";

import * as React from "react";
import Link from "next/link";
import {
  User,
  CreditCard,
  Lock,
  PhoneCall,
  X,
  Check,
  Loader2,
  ShieldCheck,
  AlertCircle,
  ExternalLink,
  Smartphone,
  Eye,
  EyeOff,
  Copy,
  FileText,
  LifeBuoy,
  Anchor,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  updateProfileDetails,
  updateAccountPasswordAction,
} from "@/app/actions/settings-actions";

interface ProfileSettingsGridProps {
  initialProfile: {
    id: string;
    full_name?: string | null;
    email?: string | null;
    phone_number?: string | null;
    role?: string | null;
  };
  helpSupportDesc: string;
}

type ActiveModal = "personal" | "payment" | "security" | "help" | null;

export function ProfileSettingsGrid({
  initialProfile,
  helpSupportDesc,
}: ProfileSettingsGridProps) {
  const [activeModal, setActiveModal] = React.useState<ActiveModal>(null);

  // Profile Form State
  const [fullName, setFullName] = React.useState(
    initialProfile.full_name || ""
  );
  const [phoneNumber, setPhoneNumber] = React.useState(
    initialProfile.phone_number || ""
  );
  const [isSavingProfile, setIsSavingProfile] = React.useState(false);

  // Payment Form State (GCash preferences saved locally & prefilled)
  const [gcashNumber, setGcashNumber] = React.useState("");
  const [gcashName, setGcashName] = React.useState("");
  const [isSavingPayment, setIsSavingPayment] = React.useState(false);

  // Password Security Form State
  const [newPassword, setNewPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [isUpdatingPassword, setIsUpdatingPassword] = React.useState(false);

  // Copied hotline feedback
  const [copiedNumber, setCopiedNumber] = React.useState<string | null>(null);

  // Hydrate payment preferences from localStorage
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const saved = localStorage.getItem("mvba_tourist_payment_method");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.gcashNumber) setGcashNumber(parsed.gcashNumber);
        if (parsed.gcashName) setGcashName(parsed.gcashName);
      } else if (initialProfile.phone_number) {
        setGcashNumber(initialProfile.phone_number);
        setGcashName(initialProfile.full_name || "");
      }
    } catch {}
  }, [initialProfile]);

  // Handle Personal Info Update
  const handleSavePersonalInfo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || fullName.trim().length < 2) {
      toast.error("Please enter a valid full name (at least 2 characters).");
      return;
    }

    if (
      phoneNumber.trim() &&
      !/^09\d{9}$/.test(phoneNumber.trim().replace(/[-\s]/g, ""))
    ) {
      toast.error(
        "Phone number must be an 11-digit Philippine mobile number starting with 09."
      );
      return;
    }

    try {
      setIsSavingProfile(true);
      const cleanPhone = phoneNumber.trim().replace(/[-\s]/g, "");
      const res = await updateProfileDetails({
        fullName: fullName.trim(),
        phoneNumber: cleanPhone,
      });

      if (res.success) {
        toast.success("Personal details updated successfully!");
        setActiveModal(null);
      } else {
        toast.error(res.error || "Failed to update personal details.");
      }
    } catch {
      toast.error("An error occurred while saving your details.");
    } finally {
      setIsSavingProfile(false);
    }
  };

  // Handle Payment Method Save
  const handleSavePaymentMethod = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanGcash = gcashNumber.trim().replace(/[-\s]/g, "");
    if (!/^09\d{9}$/.test(cleanGcash)) {
      toast.error(
        "GCash number must be exactly 11 digits starting with 09 (e.g. 09171234567)."
      );
      return;
    }

    setIsSavingPayment(true);
    try {
      localStorage.setItem(
        "mvba_tourist_payment_method",
        JSON.stringify({
          gcashNumber: cleanGcash,
          gcashName: gcashName.trim(),
        })
      );
      toast.success("GCash payment details saved for faster bookings!");
      setActiveModal(null);
    } catch {
      toast.error("Could not save payment details to device.");
    } finally {
      setIsSavingPayment(false);
    }
  };

  // Handle Password Update
  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 8) {
      toast.error("New password must be at least 8 characters long.");
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match. Please verify.");
      return;
    }

    try {
      setIsUpdatingPassword(true);
      const res = await updateAccountPasswordAction(newPassword);
      if (res.success) {
        toast.success("Account password changed successfully!");
        setNewPassword("");
        setConfirmPassword("");
        setActiveModal(null);
      } else {
        toast.error(res.error || "Failed to update password.");
      }
    } catch {
      toast.error("An error occurred while updating your password.");
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const copyHotline = (number: string, label: string) => {
    navigator.clipboard.writeText(number);
    setCopiedNumber(number);
    toast.success(`${label} copied to clipboard!`);
    setTimeout(() => setCopiedNumber(null), 2000);
  };

  return (
    <div className="space-y-6">
      {/* 4 Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* 1. Personal Info */}
        <button
          type="button"
          onClick={() => setActiveModal("personal")}
          className="flex flex-col gap-4 p-5 rounded-2xl border border-neutral-200 bg-white hover:border-neutral-900 hover:shadow-md transition-all text-left group h-full focus:outline-hidden focus:ring-2 focus:ring-neutral-900"
        >
          <div className="flex items-center justify-between w-full">
            <User className="h-8 w-8 text-neutral-800 group-hover:scale-105 transition-transform" strokeWidth={1.5} />
            <span className="text-[11px] font-semibold text-neutral-400 group-hover:text-neutral-900 transition-colors">
              Edit details &rarr;
            </span>
          </div>
          <div>
            <h3 className="font-semibold text-neutral-900 mb-1">Personal info</h3>
            <p className="text-sm text-neutral-500 leading-snug">
              Provide personal details and how we can reach you
            </p>
          </div>
        </button>

        {/* 2. Payment Methods */}
        <button
          type="button"
          onClick={() => setActiveModal("payment")}
          className="flex flex-col gap-4 p-5 rounded-2xl border border-neutral-200 bg-white hover:border-neutral-900 hover:shadow-md transition-all text-left group h-full focus:outline-hidden focus:ring-2 focus:ring-neutral-900"
        >
          <div className="flex items-center justify-between w-full">
            <CreditCard className="h-8 w-8 text-neutral-800 group-hover:scale-105 transition-transform" strokeWidth={1.5} />
            <span className="text-[11px] font-semibold text-neutral-400 group-hover:text-neutral-900 transition-colors">
              Manage GCash &rarr;
            </span>
          </div>
          <div>
            <h3 className="font-semibold text-neutral-900 mb-1">Payment methods</h3>
            <p className="text-sm text-neutral-500 leading-snug">
              Add your GCash or cards for seamless booking
            </p>
          </div>
        </button>

        {/* 3. Login & Security */}
        <button
          type="button"
          onClick={() => setActiveModal("security")}
          className="flex flex-col gap-4 p-5 rounded-2xl border border-neutral-200 bg-white hover:border-neutral-900 hover:shadow-md transition-all text-left group h-full focus:outline-hidden focus:ring-2 focus:ring-neutral-900"
        >
          <div className="flex items-center justify-between w-full">
            <Lock className="h-8 w-8 text-neutral-800 group-hover:scale-105 transition-transform" strokeWidth={1.5} />
            <span className="text-[11px] font-semibold text-neutral-400 group-hover:text-neutral-900 transition-colors">
              Update password &rarr;
            </span>
          </div>
          <div>
            <h3 className="font-semibold text-neutral-900 mb-1">Login & security</h3>
            <p className="text-sm text-neutral-500 leading-snug">
              Update your password and secure your account
            </p>
          </div>
        </button>

        {/* 4. Help & Support */}
        <button
          type="button"
          onClick={() => setActiveModal("help")}
          className="flex flex-col gap-4 p-5 rounded-2xl border border-neutral-200 bg-white hover:border-neutral-900 hover:shadow-md transition-all text-left group h-full focus:outline-hidden focus:ring-2 focus:ring-neutral-900"
        >
          <div className="flex items-center justify-between w-full">
            <PhoneCall className="h-8 w-8 text-neutral-800 group-hover:scale-105 transition-transform" strokeWidth={1.5} />
            <span className="text-[11px] font-semibold text-neutral-400 group-hover:text-neutral-900 transition-colors">
              Hotlines & Guide &rarr;
            </span>
          </div>
          <div>
            <h3 className="font-semibold text-neutral-900 mb-1">Help & support</h3>
            <p className="text-sm text-neutral-500 leading-snug">
              {helpSupportDesc}
            </p>
          </div>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* MODAL 1: PERSONAL INFO */}
      {/* ========================================================================= */}
      {activeModal === "personal" && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
          onClick={() => setActiveModal(null)}
        >
          <div
            className="w-full max-w-md rounded-3xl bg-white border border-neutral-200 p-6 shadow-2xl space-y-5 animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-neutral-100 text-neutral-900">
                  <User className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-neutral-900 text-base">Personal Info</h3>
                  <p className="text-xs text-neutral-500">Update your guest details</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="p-1.5 rounded-full hover:bg-neutral-100 text-neutral-500 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSavePersonalInfo} className="space-y-4 text-xs">
              <div className="space-y-1.5">
                <label className="font-semibold text-neutral-700 block">Full Name</label>
                <Input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Maria Clara Santos"
                  className="h-10 text-xs rounded-xl"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold text-neutral-700 block">Mobile Phone Number</label>
                <Input
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="e.g. 0917 123 4567"
                  className="h-10 text-xs rounded-xl"
                />
                <p className="text-[11px] text-neutral-500">
                  Used by hosts and the Philippine Coast Guard for boat passenger manifests.
                </p>
              </div>

              <div className="space-y-1.5 pt-1">
                <label className="font-semibold text-neutral-700 block">Email Address</label>
                <Input
                  value={initialProfile.email || ""}
                  disabled
                  className="h-10 text-xs rounded-xl bg-neutral-100 text-neutral-600 cursor-not-allowed"
                />
                <p className="text-[11px] text-neutral-400">
                  Linked to your Supabase authentication account.
                </p>
              </div>

              <div className="pt-2 flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setActiveModal(null)}
                  className="flex-1 h-10 text-xs font-semibold rounded-xl"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSavingProfile}
                  className="flex-1 h-10 text-xs font-bold rounded-xl bg-neutral-900 hover:bg-black text-white"
                >
                  {isSavingProfile ? (
                    <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                  ) : (
                    "Save Changes"
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: PAYMENT METHODS (GCash Pre-fill & Clearinghouse Guide) */}
      {/* ========================================================================= */}
      {activeModal === "payment" && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
          onClick={() => setActiveModal(null)}
        >
          <div
            className="w-full max-w-md rounded-3xl bg-white border border-neutral-200 p-6 shadow-2xl space-y-5 animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-blue-50 text-[#007DFE]">
                  <CreditCard className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-neutral-900 text-base">Payment Methods</h3>
                  <p className="text-xs text-neutral-500">GCash downpayment settings</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="p-1.5 rounded-full hover:bg-neutral-100 text-neutral-500 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSavePaymentMethod} className="space-y-4 text-xs">
              <div className="p-3.5 rounded-2xl bg-blue-50/70 border border-blue-100 text-blue-900 space-y-1 text-xs">
                <span className="font-bold block">How Booking Payments Work:</span>
                <p className="text-[11px] leading-relaxed text-blue-800">
                  MVBA operates a secure municipal clearinghouse. Once a host accepts your booking, a <strong>20% downpayment</strong> is sent via GCash. Saving your GCash credentials here pre-fills your receipts automatically.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold text-neutral-700 block">GCash Account Name</label>
                <Input
                  value={gcashName}
                  onChange={(e) => setGcashName(e.target.value)}
                  placeholder="e.g. Maria Clara S."
                  className="h-10 text-xs rounded-xl"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold text-neutral-700 block">GCash Mobile Number</label>
                <Input
                  value={gcashNumber}
                  onChange={(e) => setGcashNumber(e.target.value)}
                  placeholder="09171234567"
                  className="h-10 text-xs rounded-xl font-mono"
                  required
                />
                <p className="text-[11px] text-neutral-500">
                  Must be an 11-digit Philippine mobile number starting with 09.
                </p>
              </div>

              <div className="pt-2 flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setActiveModal(null)}
                  className="flex-1 h-10 text-xs font-semibold rounded-xl"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSavingPayment}
                  className="flex-1 h-10 text-xs font-bold rounded-xl bg-neutral-900 hover:bg-black text-white"
                >
                  {isSavingPayment ? (
                    <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                  ) : (
                    "Save GCash Details"
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: LOGIN & SECURITY (Change Password) */}
      {/* ========================================================================= */}
      {activeModal === "security" && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
          onClick={() => setActiveModal(null)}
        >
          <div
            className="w-full max-w-md rounded-3xl bg-white border border-neutral-200 p-6 shadow-2xl space-y-5 animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-purple-50 text-purple-700">
                  <Lock className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-neutral-900 text-base">Login & Security</h3>
                  <p className="text-xs text-neutral-500">Update your account password</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="p-1.5 rounded-full hover:bg-neutral-100 text-neutral-500 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleUpdatePassword} className="space-y-4 text-xs">
              <div className="space-y-1.5">
                <label className="font-semibold text-neutral-700 block">New Password</label>
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Min. 8 characters"
                    className="h-10 text-xs rounded-xl pr-10"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-700"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold text-neutral-700 block">Confirm New Password</label>
                <Input
                  type={showPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-type new password"
                  className="h-10 text-xs rounded-xl"
                  required
                />
              </div>

              <div className="p-3 rounded-2xl bg-neutral-50 border border-neutral-200 flex items-start gap-2 text-[11px] text-neutral-600">
                <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <strong>Zero-Trust Session Security:</strong> Your password is cryptographically salted and hashed. Updating your password immediately secures all your active sessions.
                </div>
              </div>

              <div className="pt-2 flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setActiveModal(null)}
                  className="flex-1 h-10 text-xs font-semibold rounded-xl"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isUpdatingPassword}
                  className="flex-1 h-10 text-xs font-bold rounded-xl bg-neutral-900 hover:bg-black text-white"
                >
                  {isUpdatingPassword ? (
                    <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                  ) : (
                    "Update Password"
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: HELP & SUPPORT (Hotlines, Guidelines, Policies) */}
      {/* ========================================================================= */}
      {activeModal === "help" && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
          onClick={() => setActiveModal(null)}
        >
          <div
            className="w-full max-w-lg rounded-3xl bg-white border border-neutral-200 p-6 shadow-2xl space-y-5 animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-emerald-50 text-emerald-700">
                  <PhoneCall className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-neutral-900 text-base">Help & Support</h3>
                  <p className="text-xs text-neutral-500">San Agustin emergency & guidelines</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="p-1.5 rounded-full hover:bg-neutral-100 text-neutral-500 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Emergency Hotlines */}
            <div className="space-y-3">
              <span className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider block">
                Official Municipal Emergency Hotlines
              </span>

              <div className="space-y-2">
                {[
                  {
                    title: "San Agustin MDRRMO (Disaster & Rescue)",
                    number: "09985551234",
                    desc: "24/7 Sea rescue, emergency medical, and weather alerts",
                  },
                  {
                    title: "San Agustin Municipal Police Station (PNP)",
                    number: "09985986371",
                    desc: "Public safety, assistance, and reporting",
                  },
                  {
                    title: "Philippine Coast Guard (PCG) Lianga Bay",
                    number: "09177245489",
                    desc: "Maritime safety and vessel dispatch clearances",
                  },
                  {
                    title: "San Agustin Municipal Tourism Office",
                    number: "09123456789",
                    desc: "Accreditation inquiries and tourist assistance",
                  },
                ].map((item) => (
                  <div
                    key={item.number}
                    className="p-3.5 rounded-2xl bg-neutral-50 border border-neutral-200 flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="space-y-0.5">
                      <p className="font-bold text-neutral-900">{item.title}</p>
                      <p className="text-[11px] text-neutral-500">{item.desc}</p>
                      <p className="font-mono text-xs font-semibold text-emerald-700">
                        {item.number}
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <a
                        href={`tel:${item.number}`}
                        className="p-2 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
                        title="Call hotline"
                      >
                        <PhoneCall className="h-3.5 w-3.5" />
                      </a>
                      <button
                        type="button"
                        onClick={() => copyHotline(item.number, item.title)}
                        className="p-2 rounded-xl bg-white border border-neutral-200 text-neutral-600 hover:bg-neutral-100 transition-colors"
                        title="Copy number"
                      >
                        {copiedNumber === item.number ? (
                          <Check className="h-3.5 w-3.5 text-emerald-600" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Platform Guides & Policies */}
            <div className="space-y-2 pt-2 border-t border-neutral-100">
              <span className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider block">
                Platform Rules & Travel Guides
              </span>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <Link
                  href="/policies"
                  target="_blank"
                  className="p-3 rounded-xl border border-neutral-200 hover:border-neutral-900 bg-white flex items-center justify-between font-semibold text-neutral-800 transition-colors"
                >
                  <span className="flex items-center gap-1.5">
                    <Anchor className="h-3.5 w-3.5 text-blue-600" />
                    Eco-Tourism Rules
                  </span>
                  <ExternalLink className="h-3 w-3 text-neutral-400" />
                </Link>

                <Link
                  href="/terms"
                  target="_blank"
                  className="p-3 rounded-xl border border-neutral-200 hover:border-neutral-900 bg-white flex items-center justify-between font-semibold text-neutral-800 transition-colors"
                >
                  <span className="flex items-center gap-1.5">
                    <FileText className="h-3.5 w-3.5 text-neutral-600" />
                    Terms of Service
                  </span>
                  <ExternalLink className="h-3 w-3 text-neutral-400" />
                </Link>

                <Link
                  href="/privacy"
                  target="_blank"
                  className="p-3 rounded-xl border border-neutral-200 hover:border-neutral-900 bg-white flex items-center justify-between font-semibold text-neutral-800 transition-colors"
                >
                  <span className="flex items-center gap-1.5">
                    <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                    Privacy Policy
                  </span>
                  <ExternalLink className="h-3 w-3 text-neutral-400" />
                </Link>

                <Link
                  href="/explore"
                  className="p-3 rounded-xl border border-neutral-200 hover:border-neutral-900 bg-white flex items-center justify-between font-semibold text-neutral-800 transition-colors"
                >
                  <span className="flex items-center gap-1.5">
                    <LifeBuoy className="h-3.5 w-3.5 text-amber-600" />
                    24 Islands Guide
                  </span>
                  <ExternalLink className="h-3 w-3 text-neutral-400" />
                </Link>
              </div>
            </div>

            <div className="pt-2">
              <Button
                type="button"
                onClick={() => setActiveModal(null)}
                className="w-full h-10 text-xs font-bold rounded-xl bg-neutral-900 hover:bg-black text-white"
              >
                Close Help Center
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
