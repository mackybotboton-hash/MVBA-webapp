"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  Users,
  Search,
  CheckCircle2,
  XCircle,
  ShieldCheck,
  RefreshCw,
  Clock,
  UserX,
  MessageSquare,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default function AdminUsersPage() {
  const [users, setUsers] = React.useState<any[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [roleFilter, setRoleFilter] = React.useState<string>("all");
  const [approvalFilter, setApprovalFilter] = React.useState<string>("all");

  const fetchUsers = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setUsers(data || []);
    } catch (err: any) {
      toast.error(err.message || "Failed to load users");
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleToggleApproval = async (
    userId: string,
    currentApproval: boolean,
    userName?: string
  ) => {
    try {
      const supabase = createClient();
      const { error } = await (supabase.from("profiles") as any)
        .update({ is_approved: !currentApproval })
        .eq("id", userId);

      if (error) throw error;

      setUsers((prev) =>
        prev.map((u) =>
          u.id === userId ? { ...u, is_approved: !currentApproval } : u
        )
      );

      toast.success(
        !currentApproval
          ? `Account approved! ${userName || "User"} is now verified.`
          : `Approval revoked for ${userName || "user"}.`
      );
    } catch (err: any) {
      toast.error(err.message || "Failed to update user approval status");
    }
  };

  const handleApproveAllPending = async () => {
    const pendingUsers = users.filter((u) => !u.is_approved);
    if (pendingUsers.length === 0) {
      toast.info("No pending accounts to approve.");
      return;
    }
    const pendingIds = pendingUsers.map((u) => u.id);
    try {
      const supabase = createClient();
      const { error } = await (supabase.from("profiles") as any)
        .update({ is_approved: true })
        .in("id", pendingIds);

      if (error) throw error;

      setUsers((prev) =>
        prev.map((u) =>
          pendingIds.includes(u.id) ? { ...u, is_approved: true } : u
        )
      );

      toast.success(`Successfully approved ${pendingIds.length} pending accounts!`);
    } catch (err: any) {
      toast.error(err.message || "Failed to approve pending accounts");
    }
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    try {
      const supabase = createClient();
      const { error } = await (supabase.from("profiles") as any)
        .update({ role: newRole })
        .eq("id", userId);

      if (error) throw error;

      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u))
      );

      toast.success(`Role updated to ${newRole}`);
    } catch (err: any) {
      toast.error(err.message || "Failed to update role");
    }
  };

  const filteredUsers = React.useMemo(() => {
    return users.filter((u) => {
      const name = (u.full_name || "").toLowerCase();
      const email = (u.email || "").toLowerCase();
      const q = searchQuery.toLowerCase();

      const matchesSearch = !q || name.includes(q) || email.includes(q);
      const matchesRole = roleFilter === "all" || u.role === roleFilter;
      const matchesApproval =
        approvalFilter === "all" ||
        (approvalFilter === "approved" && u.is_approved) ||
        (approvalFilter === "pending" && !u.is_approved);

      return matchesSearch && matchesRole && matchesApproval;
    });
  }, [users, searchQuery, roleFilter, approvalFilter]);

  const pendingCount = users.filter((u) => !u.is_approved).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900 tracking-tight">
            User & Role Management
          </h1>
          <p className="text-xs sm:text-sm text-neutral-600 mt-1">
            Approve and manage member accounts, permissions, and roles across Bretania
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          {pendingCount > 0 && (
            <Button
              size="xs"
              onClick={handleApproveAllPending}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow-xs flex items-center gap-1.5"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>Approve All Pending ({pendingCount})</span>
            </Button>
          )}

          <button
            onClick={fetchUsers}
            disabled={isLoading}
            className="flex items-center gap-1.5 text-xs font-semibold text-neutral-600 hover:text-black px-3 py-1.5 rounded-lg border border-neutral-200 bg-white hover:bg-neutral-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-neutral-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name or email..."
            className="w-full h-9 pl-9 pr-3 rounded-lg border border-neutral-200 text-xs text-neutral-900 focus:outline-none focus:ring-1 focus:ring-black"
          />
        </div>

        <div className="flex items-center gap-2">
          {/* Role Filter */}
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="h-9 px-3 rounded-lg border border-neutral-200 text-xs text-neutral-700 bg-white focus:outline-none focus:ring-1 focus:ring-black"
          >
            <option value="all">All Roles</option>
            <option value="homestay">Homestay Owner</option>
            <option value="resort">Resort Owner</option>
            <option value="tourist">Tourist</option>
            <option value="admin">Admin</option>
          </select>

          {/* Approval Filter */}
          <select
            value={approvalFilter}
            onChange={(e) => setApprovalFilter(e.target.value)}
            className="h-9 px-3 rounded-lg border border-neutral-200 text-xs text-neutral-700 bg-white focus:outline-none focus:ring-1 focus:ring-black"
          >
            <option value="all">All Statuses</option>
            <option value="approved">Approved</option>
            <option value="pending">Pending Approval</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-neutral-200 bg-white overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-neutral-200 bg-neutral-50 text-neutral-600 uppercase tracking-wider font-semibold">
                <th className="px-5 py-3">Member</th>
                <th className="px-5 py-3">Role</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Registered Date</th>
                <th className="px-5 py-3 text-right">Approval Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-neutral-500">
                    No users matching the filters found.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-neutral-50/60 transition-colors">
                    <td className="px-5 py-3.5">
                      <p className="font-semibold text-neutral-900">
                        {u.full_name || "Guest Account"}
                      </p>
                      <p className="text-neutral-500 text-[11px]">{u.email}</p>
                    </td>

                    <td className="px-5 py-3.5">
                      <select
                        value={u.role}
                        onChange={(e) => handleRoleChange(u.id, e.target.value)}
                        className="text-xs py-1 px-2 rounded-md border border-neutral-200 bg-white font-medium text-neutral-800 capitalize"
                      >
                        <option value="tourist">Tourist</option>
                        <option value="homestay">Homestay</option>
                        <option value="resort">Resort</option>
                        <option value="admin">Admin</option>
                      </select>
                    </td>

                    <td className="px-5 py-3.5">
                      <Badge
                        variant={u.is_approved ? "success" : "warning"}
                        size="sm"
                        dot
                      >
                        {u.is_approved ? "Approved" : "Pending"}
                      </Badge>
                    </td>

                    <td className="px-5 py-3.5 text-neutral-600">
                      {new Date(u.created_at).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </td>

                    <td className="px-5 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {(u.role === "homestay" || u.role === "resort") && (
                          <Link
                            href={`/admin/chat?recipient=${u.id}`}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-neutral-200 bg-white text-[11px] font-semibold text-neutral-700 hover:text-black hover:bg-neutral-50 transition-colors shadow-2xs"
                            title="Chat with Owner"
                          >
                            <MessageSquare className="h-3 w-3 text-neutral-600" />
                            <span>Chat</span>
                          </Link>
                        )}
                        <Button
                          size="xs"
                          variant={u.is_approved ? "outline" : "default"}
                          onClick={() =>
                            handleToggleApproval(u.id, u.is_approved, u.full_name)
                          }
                          className={
                            u.is_approved
                              ? "border-neutral-200 text-neutral-600 hover:text-red-600 hover:border-red-200 text-[11px]"
                              : "bg-black text-white hover:bg-neutral-800 text-[11px] font-bold shadow-xs"
                          }
                        >
                          {u.is_approved ? "Revoke Approval" : "Approve Account"}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
