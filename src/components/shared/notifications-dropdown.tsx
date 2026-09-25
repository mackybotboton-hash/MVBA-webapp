"use client";

import React, { useState } from "react";
import { Bell, CheckCircle2, MessageSquare, Info, Calendar } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useNotificationCounts, markNotificationRead, markAllNotificationsRead, deleteAllNotifications } from "@/hooks/use-notification-counts";
import { createClient } from "@/lib/supabase/client";
import { formatDistanceToNow } from "date-fns";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";

export function NotificationsDropdown() {
  const { user, profile } = useAuth();
  const role = profile?.role;
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
      .limit(30);
    if (data) {
      // Grouping logic for 'new_message'
      const processed: any[] = [];
      const seenMessageTitles = new Set<string>();

      data.forEach((notif: any) => {
        if (notif.type === "new_message") {
          if (!seenMessageTitles.has(notif.title)) {
            seenMessageTitles.add(notif.title);
            processed.push(notif);
          }
        } else {
          processed.push(notif);
        }
      });
      
      setNotifications(processed.slice(0, 10)); // keep only top 10 after grouping
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

  const handleMarkAllAsRead = async () => {
    if (!user) return;
    await markAllNotificationsRead(user.id);
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
  };

  const handleDeleteAll = async () => {
    if (!user) return;
    await deleteAllNotifications(user.id);
    setNotifications([]);
  };

  const hasUnread = notifications.some(n => !n.is_read);

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
      <DropdownMenuContent className="w-80 p-0 mr-4 mt-2 rounded-xl shadow-xl overflow-hidden bg-white z-50 border border-neutral-200/60" align="end">
        <div className="bg-neutral-50 px-4 py-3 border-b border-neutral-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-sm">Notifications</h3>
            {bellCount > 0 && (
              <span className="text-[10px] bg-black text-white px-1.5 py-0.5 rounded-full font-medium">
                {bellCount}
              </span>
            )}
          </div>
          {notifications.length > 0 && (
            hasUnread ? (
              <button onClick={handleMarkAllAsRead} className="text-xs text-blue-600 hover:text-blue-800 font-medium">
                Mark all read
              </button>
            ) : (
              <button onClick={handleDeleteAll} className="text-xs text-red-600 hover:text-red-800 font-medium">
                Delete all
              </button>
            )
          )}
        </div>
        
        {/* Quick Links for generic unseen items */}
        {(counts.unreadMessages > 0 || counts.unseenBookings > 0 || counts.pendingTransactions > 0) && (
          <div className="p-2 border-b border-neutral-100 bg-blue-50/50">
            {counts.unreadMessages > 0 && (
              <DropdownMenuItem 
                onClick={() => {
                  if (role === 'admin') router.push('/admin/chat');
                  else if (role === 'resort') router.push('/resort/chat');
                  else if (role === 'homestay') router.push('/homestay/chat');
                  else router.push('/chat');
                }} 
                className="cursor-pointer text-xs font-medium text-blue-700 py-2"
              >
                <MessageSquare className="w-3.5 h-3.5 mr-2" />
                You have {counts.unreadMessages} unread message(s)
              </DropdownMenuItem>
            )}
            {counts.unseenBookings > 0 && (
              <DropdownMenuItem 
                onClick={() => {
                  if (role === 'resort') router.push('/resort/bookings');
                  else if (role === 'homestay') router.push('/homestay/bookings');
                  else router.push('/bookings');
                }} 
                className="cursor-pointer text-xs font-medium text-blue-700 py-2"
              >
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
