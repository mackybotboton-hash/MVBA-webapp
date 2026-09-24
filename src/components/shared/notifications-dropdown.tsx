"use client";

import React, { useState } from "react";
import { Bell, CheckCircle2, MessageSquare, Info, Calendar } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useNotificationCounts, markNotificationRead } from "@/hooks/use-notification-counts";
import { createClient } from "@/lib/supabase/client";
import { formatDistanceToNow } from "date-fns";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";

export function NotificationsDropdown() {
  const { user } = useAuth();
  const counts = useNotificationCounts();
  const bellCount = counts.unreadMessages + counts.unseenBookings + counts.pendingTransactions + counts.unreadSystemNotifications;
  const router = useRouter();

  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Fetch notifications from the database
  const fetchNotifications = async () => {
    if (!user) return;
    setLoading(true);
    const supabase = createClient();
    const { data } = await (supabase.from("notifications") as any)
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(10);
    if (data) {
      setNotifications(data);
    }
    setLoading(false);
  };

  // Re-fetch when the dropdown is opened
  const handleOpenChange = (open: boolean) => {
    if (open) {
      fetchNotifications();
    }
  };

  const handleNotificationClick = async (notif: any) => {
    if (!notif.is_read) {
      await markNotificationRead(notif.id);
      // Update local state to reflect read status
      setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, is_read: true } : n));
    }
    if (notif.url) {
      router.push(notif.url);
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case "new_booking":
      case "booking_status":
        return <Calendar className="h-4 w-4 text-blue-500" />;
      case "new_message":
        return <MessageSquare className="h-4 w-4 text-emerald-500" />;
      case "deposit_verified":
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      default:
        return <Info className="h-4 w-4 text-neutral-500" />;
    }
  };

  return (
    <DropdownMenu onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger
        className="relative p-2 rounded-lg hover:bg-gray-100 transition-colors focus:outline-none"
        aria-label={`Notifications${bellCount > 0 ? ` (${bellCount} unread)` : ""}`}
      >
        <Bell className="h-5 w-5 text-gray-500" />
        {bellCount > 0 && (
          <span className="absolute top-1 right-1 min-w-[16px] h-4 px-[3px] rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center leading-none shadow-sm animate-in zoom-in-75 duration-200">
            {bellCount > 99 ? "99+" : bellCount}
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-80 p-0 mr-4 mt-2 rounded-xl shadow-xl overflow-hidden" align="end">
        <div className="bg-neutral-50 px-4 py-3 border-b border-neutral-100 flex items-center justify-between">
          <h3 className="font-bold text-sm">Notifications</h3>
          {bellCount > 0 && (
            <span className="text-xs bg-black text-white px-2 py-0.5 rounded-full font-medium">
              {bellCount} New
            </span>
          )}
        </div>
        
        {/* Quick Links for generic unseen items */}
        {(counts.unreadMessages > 0 || counts.unseenBookings > 0 || counts.pendingTransactions > 0) && (
          <div className="p-2 border-b border-neutral-100 bg-blue-50/50">
            {counts.unreadMessages > 0 && (
              <DropdownMenuItem onClick={() => router.push('/messages')} className="cursor-pointer text-xs font-medium text-blue-700 py-2">
                <MessageSquare className="w-3.5 h-3.5 mr-2" />
                You have {counts.unreadMessages} unread message(s)
              </DropdownMenuItem>
            )}
            {counts.unseenBookings > 0 && (
              <DropdownMenuItem onClick={() => router.push('/resort/bookings')} className="cursor-pointer text-xs font-medium text-blue-700 py-2">
                <Calendar className="w-3.5 h-3.5 mr-2" />
                You have {counts.unseenBookings} unseen booking request(s)
              </DropdownMenuItem>
            )}
            {counts.pendingTransactions > 0 && (
              <DropdownMenuItem onClick={() => router.push('/admin/transactions')} className="cursor-pointer text-xs font-medium text-blue-700 py-2">
                <CheckCircle2 className="w-3.5 h-3.5 mr-2" />
                You have {counts.pendingTransactions} pending transaction(s)
              </DropdownMenuItem>
            )}
          </div>
        )}

        <div className="max-h-[300px] overflow-y-auto">
          {loading ? (
            <div className="p-8 text-center text-xs text-neutral-500 flex items-center justify-center">
              <span className="animate-pulse">Loading...</span>
            </div>
          ) : notifications.length === 0 ? (
            <div className="p-8 text-center text-xs text-neutral-500">No recent notifications</div>
          ) : (
            notifications.map((notif) => (
              <div
                key={notif.id}
                onClick={() => handleNotificationClick(notif)}
                className={`p-3 border-b border-neutral-100 last:border-0 cursor-pointer transition-colors hover:bg-neutral-50 flex gap-3 ${!notif.is_read ? 'bg-neutral-50/50' : 'opacity-70'}`}
              >
                <div className="mt-1 flex-shrink-0">
                  {getIcon(notif.type)}
                </div>
                <div className="flex-1 space-y-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className={`text-xs font-semibold ${!notif.is_read ? 'text-black' : 'text-neutral-700'}`}>
                      {notif.title}
                    </p>
                    {notif.created_at && (
                      <span className="text-[10px] text-neutral-400 flex-shrink-0 whitespace-nowrap">
                        {formatDistanceToNow(new Date(notif.created_at), { addSuffix: true })}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-neutral-500 leading-snug line-clamp-2">
                    {notif.body}
                  </p>
                </div>
                {!notif.is_read && (
                  <div className="w-1.5 h-1.5 bg-blue-500 rounded-full flex-shrink-0 mt-2" />
                )}
              </div>
            ))
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
