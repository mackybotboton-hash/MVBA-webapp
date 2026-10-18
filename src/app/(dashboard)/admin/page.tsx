"use client";

import * as React from "react";
import Link from "next/link";
import {
  Users,
  Building2,
  CheckCircle2,
  Clock,
  RefreshCw,
  ExternalLink,
  UserPlus,
  TrendingUp,
  CreditCard,
  Send,
  AlertCircle,
  ArrowRight,
  ShieldAlert,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { AddUserModal } from "@/components/admin/add-user-modal";
import { createClient } from "@/lib/supabase/client";
import { getAdminDashboardMetricsAction } from "@/app/actions/admin-dashboard-actions";
import {
  DEFAULT_ADMIN_REVENUE_GOAL,
  type AdminDashboardMetrics,
} from "@/lib/admin-metrics-helper";

const initialMetrics: AdminDashboardMetrics = {
  targetGoal: DEFAULT_ADMIN_REVENUE_GOAL,
  earnedCommission: 0,
  pendingCommission: 0,
  remainingToGoal: DEFAULT_ADMIN_REVENUE_GOAL,
  progressPercent: 0,
  actionCounters: {
    depositsAwaitingVerification: 0,
    payoutsDue: 0,
    cancellationsAwaitingRefundDecision: 0,
  },
};

export default function AdminDashboardPage() {
  const [stats, setStats] = React.useState({
    totalUsers: 0,
    pendingUsers: 0,
    totalProperties: 0,
    totalBookings: 0,
  });
  const [financialMetrics, setFinancialMetrics] =
    React.useState<AdminDashboardMetrics>(initialMetrics);
  const [recentUsers, setRecentUsers] = React.useState<any[]>([]);
  const [recentProperties, setRecentProperties] = React.useState<any[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isAddUserModalOpen, setIsAddUserModalOpen] = React.useState(false);

  const fetchData = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const supabase = createClient();

      // 1. Fetch Platform Metrics via Server Action (Full-Commission Model)
      const metricsRes = await getAdminDashboardMetricsAction();
      if (metricsRes.success && metricsRes.data) {
        setFinancialMetrics(metricsRes.data);
      }

      // 2. Fetch Users
      const { data: usersData } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });

      const allUsers = (usersData as any[]) || [];
      const pending = allUsers.filter((u) => !u.is_approved);

      // 3. Fetch Properties
      const { data: propsData } = await supabase
        .from("properties")
        .select("*")
        .order("created_at", { ascending: false });

      const allProps = (propsData as any[]) || [];

      // 4. Fetch Bookings count
      const { data: bData } = await supabase.from("bookings").select("id");

      setStats({
        totalUsers: allUsers.length,
        pendingUsers: pending.length,
        totalProperties: allProps.length,
        totalBookings: (bData || []).length,
      });

      setRecentUsers(allUsers.slice(0, 5));
      setRecentProperties(allProps.slice(0, 5));
    } catch {
      // Ignored
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  const {
    targetGoal,
    earnedCommission,
    pendingCommission,
    remainingToGoal,
    progressPercent,
    actionCounters,
  } = financialMetrics;

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-neutral-200 pb-3.5 sm:pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-neutral-900 tracking-tight">
              Panaw Portal
            </h1>

            <Badge variant="default" size="sm">
              Administrator
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-neutral-600 mt-0.5">
            Municipal tourism oversight, commission revenue, and booking operations
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          <button
            onClick={() => setIsAddUserModalOpen(true)}
            className="flex items-center gap-1.5 text-xs font-semibold text-white bg-black hover:bg-neutral-800 px-3.5 py-2 rounded-xl transition-colors shadow-2xs"
          >
            <UserPlus className="h-3.5 w-3.5" />
            <span>Add User</span>
          </button>
          <button
            onClick={fetchData}
            disabled={isLoading}
            className="flex items-center gap-1.5 text-xs font-semibold text-neutral-600 hover:text-black transition-colors"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
            <span>Refresh Data</span>
          </button>
        </div>
      </div>

      <AddUserModal
        isOpen={isAddUserModalOpen}
        onClose={() => {
          setIsAddUserModalOpen(false);
          fetchData();
        }}
      />

      {/* Business Goal Tracker Card */}
      <div className="rounded-2xl border border-neutral-200 bg-linear-to-br from-white to-neutral-50/70 p-4 sm:p-5 shadow-2xs space-y-3.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-100">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-neutral-900">
                Revenue Goal Tracker
              </h2>
              <p className="text-xs text-neutral-500">
                Commission progress toward municipal target of ₱{targetGoal.toLocaleString()}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-2xl font-black text-neutral-900">
              {progressPercent}%
            </span>
            <span className="text-xs font-medium text-neutral-500 uppercase tracking-wider">
              Achieved
            </span>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="space-y-1.5">
          <div className="h-3 w-full bg-neutral-100 rounded-full overflow-hidden border border-neutral-200/60 p-0.5">
            <div
              className="h-full bg-linear-to-r from-emerald-600 to-teal-500 rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, Math.max(0, progressPercent))}%` }}
            />
          </div>
          <div className="flex justify-between text-[11px] text-neutral-500 font-medium">
            <span>₱0</span>
            <span>Target: ₱{targetGoal.toLocaleString()}</span>
          </div>
        </div>

        {/* Financial Highlights */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1 border-t border-neutral-100">
          <div className="rounded-xl bg-white p-3.5 border border-neutral-100 shadow-2xs">
            <span className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider block">
              Earned Commission
            </span>
            <p className="text-xl font-bold text-emerald-700 mt-1">
              ₱{earnedCommission.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <span className="text-[11px] text-neutral-400">
              Completed stays & past checkout
            </span>
          </div>

          <div className="rounded-xl bg-white p-3.5 border border-neutral-100 shadow-2xs">
            <span className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider block">
              Pending Commission
            </span>
            <p className="text-xl font-bold text-amber-700 mt-1">
              ₱{pendingCommission.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <span className="text-[11px] text-neutral-400">
              Upcoming verified bookings
            </span>
          </div>

          <div className="rounded-xl bg-white p-3.5 border border-neutral-100 shadow-2xs">
            <span className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider block">
              Remaining to Goal
            </span>
            <p className="text-xl font-bold text-neutral-900 mt-1">
              ₱{remainingToGoal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <span className="text-[11px] text-neutral-400">
              {remainingToGoal === 0 ? "Goal met!" : "Needed to reach ₱15,000"}
            </span>
          </div>
        </div>
      </div>

      {/* Action Counters Row */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-bold text-neutral-500 uppercase tracking-wider">
            Operational Action Items
          </h2>
          <span className="text-xs text-neutral-400">
            Click to take action
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* 1. Deposits Awaiting Verification */}
          <Link
            href="/admin/transactions?tab=verifying"
            className="group block rounded-2xl border border-neutral-200 bg-white p-5 hover:border-amber-400 hover:shadow-xs transition-all"
          >
            <div className="flex items-center justify-between">
              <div className="h-9 w-9 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center border border-amber-100">
                <CreditCard className="h-4 w-4" />
              </div>
              <span className="text-2xl font-bold text-neutral-900 group-hover:text-amber-700 transition-colors">
                {actionCounters.depositsAwaitingVerification}
              </span>
            </div>
            <div className="mt-3">
              <h3 className="text-sm font-bold text-neutral-900">
                Deposits Awaiting Verification
              </h3>
              <p className="text-xs text-neutral-500 mt-0.5">
                Tourists who uploaded GCash payment receipts
              </p>
            </div>
            <div className="mt-4 flex items-center gap-1 text-xs font-semibold text-amber-700">
              <span>Review deposits</span>
              <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
            </div>
          </Link>

          {/* 2. Payouts Due */}
          <Link
            href="/admin/transactions?tab=verified"
            className="group block rounded-2xl border border-neutral-200 bg-white p-5 hover:border-emerald-400 hover:shadow-xs transition-all"
          >
            <div className="flex items-center justify-between">
              <div className="h-9 w-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-100">
                <Send className="h-4 w-4" />
              </div>
              <span className="text-2xl font-bold text-neutral-900 group-hover:text-emerald-700 transition-colors">
                {actionCounters.payoutsDue}
              </span>
            </div>
            <div className="mt-3">
              <h3 className="text-sm font-bold text-neutral-900">
                Payouts Due to Hosts
              </h3>
              <p className="text-xs text-neutral-500 mt-0.5">
                Verified deposits ready to disburse to hosts
              </p>
            </div>
            <div className="mt-4 flex items-center gap-1 text-xs font-semibold text-emerald-700">
              <span>Process payouts</span>
              <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
            </div>
          </Link>

          {/* 3. Cancellations Awaiting Refund Decision */}
          <Link
            href="/admin/transactions?tab=cancelled"
            className="group block rounded-2xl border border-neutral-200 bg-white p-5 hover:border-rose-400 hover:shadow-xs transition-all"
          >
            <div className="flex items-center justify-between">
              <div className="h-9 w-9 rounded-xl bg-rose-50 text-rose-700 flex items-center justify-center border border-rose-100">
                <ShieldAlert className="h-4 w-4" />
              </div>
              <span className="text-2xl font-bold text-neutral-900 group-hover:text-rose-700 transition-colors">
                {actionCounters.cancellationsAwaitingRefundDecision}
              </span>
            </div>
            <div className="mt-3">
              <h3 className="text-sm font-bold text-neutral-900">
                Cancelled Awaiting Refund
              </h3>
              <p className="text-xs text-neutral-500 mt-0.5">
                Cancelled bookings pending refund review
              </p>
            </div>
            <div className="mt-4 flex items-center gap-1 text-xs font-semibold text-rose-700">
              <span>Review cancellations</span>
              <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
            </div>
          </Link>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-neutral-200 bg-white p-5 space-y-2 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">
              Total Users
            </span>
            <Users className="h-4 w-4 text-neutral-500" />
          </div>
          <p className="text-2xl font-bold text-neutral-900">
            {stats.totalUsers}
          </p>
          <Link
            href="/admin/users"
            className="text-xs text-neutral-600 hover:text-black font-medium inline-block"
          >
            Manage users &rarr;
          </Link>
        </div>

        <div className="rounded-xl border border-neutral-200 bg-white p-5 space-y-2 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">
              Pending Approvals
            </span>
            <Clock className="h-4 w-4 text-amber-500" />
          </div>
          <p className="text-2xl font-bold text-neutral-900">
            {stats.pendingUsers}
          </p>
          <span className="text-xs text-neutral-600">
            Owners awaiting certification
          </span>
        </div>

        <div className="rounded-xl border border-neutral-200 bg-white p-5 space-y-2 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">
              Active Properties
            </span>
            <Building2 className="h-4 w-4 text-neutral-500" />
          </div>
          <p className="text-2xl font-bold text-neutral-900">
            {stats.totalProperties}
          </p>
          <span className="text-xs text-neutral-600">
            Homestays & Resorts in Bretania
          </span>
        </div>

        <div className="rounded-xl border border-neutral-200 bg-white p-5 space-y-2 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">
              Total Bookings
            </span>
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-bold text-neutral-900">
            {stats.totalBookings}
          </p>
          <span className="text-xs text-neutral-600">
            Reservations processed
          </span>
        </div>
      </div>

      {/* Tables Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5">
        {/* Recent Registrations */}
        <div className="rounded-2xl border border-neutral-200 bg-white p-5 space-y-4 shadow-xs">
          <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
            <h2 className="font-bold text-base text-neutral-900">
              Registered Accounts
            </h2>
            <Link
              href="/admin/users"
              className="text-xs font-semibold text-neutral-600 hover:text-black"
            >
              View all &rarr;
            </Link>
          </div>

          {recentUsers.length === 0 ? (
            <div className="py-8 text-center text-xs text-neutral-400">
              No registered accounts found
            </div>
          ) : (
            <div className="divide-y divide-neutral-100">
              {recentUsers.map((u) => (
                <div
                  key={u.id}
                  className="py-2.5 flex items-center justify-between text-xs"
                >
                  <div>
                    <p className="font-semibold text-neutral-900">
                      {u.full_name || u.email}
                    </p>
                    <p className="text-neutral-600 text-[11px]">{u.email}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="subtle" size="sm" className="capitalize">
                      {u.role}
                    </Badge>
                    <Badge
                      variant={u.is_approved ? "success" : "warning"}
                      size="sm"
                    >
                      {u.is_approved ? "Approved" : "Pending"}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Association Properties */}
        <div className="rounded-2xl border border-neutral-200 bg-white p-5 space-y-4 shadow-xs">
          <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
            <h2 className="font-bold text-base text-neutral-900">
              Bretania Properties
            </h2>
            <Link
              href="/"
              target="_blank"
              className="text-xs font-semibold text-neutral-600 hover:text-black flex items-center gap-1"
            >
              <span>View Marketplace</span>
              <ExternalLink className="h-3 w-3" />
            </Link>
          </div>

          {recentProperties.length === 0 ? (
            <div className="py-8 text-center text-xs text-neutral-400">
              No properties registered yet
            </div>
          ) : (
            <div className="divide-y divide-neutral-100">
              {recentProperties.map((p) => (
                <div
                  key={p.id}
                  className="py-2.5 flex items-center justify-between text-xs"
                >
                  <div>
                    <p className="font-semibold text-neutral-900">{p.name}</p>
                    <p className="text-neutral-600 text-[11px]">
                      {p.address || "Bretania, San Agustin"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="subtle" size="sm" className="capitalize">
                      {p.type}
                    </Badge>
                    <Badge variant="success" size="sm" dot>
                      {p.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
