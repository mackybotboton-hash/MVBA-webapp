"use client";

import * as React from "react";
import Link from "next/link";
import {
  Users,
  Building2,
  Receipt,
  Megaphone,
  CheckCircle2,
  Clock,
  RefreshCw,
  ExternalLink,
  UserPlus,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AddUserModal } from "@/components/admin/add-user-modal";
import { createClient } from "@/lib/supabase/client";

export default function AdminDashboardPage() {
  const [stats, setStats] = React.useState({
    totalUsers: 0,
    pendingUsers: 0,
    totalProperties: 0,
    totalBookings: 0,
  });
  const [recentUsers, setRecentUsers] = React.useState<any[]>([]);
  const [recentProperties, setRecentProperties] = React.useState<any[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isAddUserModalOpen, setIsAddUserModalOpen] = React.useState(false);

  const fetchData = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const supabase = createClient();

      // 1. Fetch Users
      const { data: usersData } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });

      const allUsers = (usersData as any[]) || [];
      const pending = allUsers.filter((u) => !u.is_approved);

      // 2. Fetch Properties
      const { data: propsData } = await supabase
        .from("properties")
        .select("*")
        .order("created_at", { ascending: false });

      const allProps = (propsData as any[]) || [];

      // 3. Fetch Bookings count
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-200 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-neutral-900 tracking-tight">
              MVBA Association Portal
            </h1>

            <Badge variant="default" size="sm">
              Administrator
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-neutral-600 mt-1">
            Municipal tourism oversight, owner approvals, and association dues tracking
          </p>
        </div>

        <div className="flex items-center gap-3 self-start sm:self-auto">
          <button
            onClick={() => setIsAddUserModalOpen(true)}
            className="flex items-center gap-1.5 text-xs font-semibold text-white bg-black hover:bg-neutral-800 px-4 py-2 rounded-xl transition-colors shadow-sm"
          >
            <UserPlus className="h-3.5 w-3.5" />
            <span>Add User</span>
          </button>
          <button
            onClick={fetchData}
            disabled={isLoading}
            className="flex items-center gap-1.5 text-xs font-semibold text-neutral-600 hover:text-black"
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
          fetchData(); // Refresh list after adding
        }} 
      />

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
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
        </div>
      </div>
    </div>
  );
}
