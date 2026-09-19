"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Send,
  User,
  Search,
  CheckCheck,
  Check,
  RefreshCw,
  MessageSquare,
  Building2,
  Home,
  Phone,
  Calendar,
  Sparkles,
  Loader2,
  ShieldCheck,
  Plus,
  X,
  MessageCircleOff,
  ChevronLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { LoadingLogo } from "@/components/shared/loading-logo";
import { createClient } from "@/lib/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export interface ChatContact {
  id: string; // User/Profile ID
  name: string;
  role: "tourist" | "homestay" | "resort" | "admin";
  propertyName?: string;
  roomName?: string;
  lastMessage?: string;
  lastTime?: string;
  lastMessageCreatedAt?: string;
  lastMessageSenderId?: string;
  lastMessageIsRead?: boolean; // True if the last message has been read by its recipient
  unreadCount?: number; // Count of unread messages for current user
  phone?: string;
}

export interface ChatMessageItem {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  created_at: string;
  is_read?: boolean;
}

export interface ConnectedChatSystemProps {
  currentRole: "tourist" | "homestay" | "resort" | "admin";
  portalTitle: string;
  portalSubtitle: string;
}

/**
 * Format message timestamps smartly like Messenger:
 * - Today: "11:34 AM"
 * - Yesterday: "Yesterday"
 * - Older: "Sep 2"
 */
function formatMessageTime(dateString?: string): string {
  if (!dateString) return "Recent";
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return dateString;

  const now = new Date();
  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  if (isToday) {
    return date.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday =
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear();

  if (isYesterday) {
    return "Yesterday";
  }

  return date.toLocaleDateString([], {
    month: "short",
    day: "numeric",
  });
}

function ChatSystemContent({
  currentRole,
  portalTitle,
  portalSubtitle,
}: ConnectedChatSystemProps) {
  const searchParams = useSearchParams();
  const targetGuestId = searchParams.get("guest") || searchParams.get("recipient");

  const [currentUser, setCurrentUser] = React.useState<any>(null);
  const [contacts, setContacts] = React.useState<ChatContact[]>([]);
  const [activeContact, setActiveContact] = React.useState<ChatContact | null>(null);
  const [messages, setMessages] = React.useState<ChatMessageItem[]>([]);
  const [inputText, setInputText] = React.useState("");
  const [searchQuery, setSearchQuery] = React.useState("");
  const [isLoadingContacts, setIsLoadingContacts] = React.useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = React.useState(false);
  const [isSending, setIsSending] = React.useState(false);
  const [isMobile, setIsMobile] = React.useState(false);

  React.useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile(); // Check initially
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Admin & Host inter-communication state
  const [availableHosts, setAvailableHosts] = React.useState<any[]>([
    {
      id: "2853057a-9c5e-490e-8c3a-49330721b57b",
      name: "Maria Santos",
      role: "homestay",
      propertyName: "Poy-an Homestay",
      phone: "+63 912 000 0002",
      email: "homestay@mvba.test",
    },
    {
      id: "678e0d9b-640a-429a-8c90-ef07dc6d4567",
      name: "Bretania Sands Beach Resort",
      role: "resort",
      propertyName: "Bretania Sands Beach Resort",
      phone: "+63 912 345 6788",
      email: "resort@mvba.test",
    },
  ]);
  const [isHostPickerOpen, setIsHostPickerOpen] = React.useState(false);
  const [hostPickerSearch, setHostPickerSearch] = React.useState("");
  const [adminProfile, setAdminProfile] = React.useState<any>({
    id: "c603667a-8f10-4951-88be-76b29c3fe068",
    name: "MVBA Association Admin",
    role: "admin",
    propertyName: "MVBA Association Office",
    phone: "+63 912 000 0001",
    email: "admin@mvba.test",
  });

  const messagesContainerRef = React.useRef<HTMLDivElement>(null);
  const isNearBottomRef = React.useRef(true);
  const shouldScrollToBottomRef = React.useRef(true);
  
  // Swipe to go back tracking
  const touchStartXRef = React.useRef<number | null>(null);
  const touchEndXRef = React.useRef<number | null>(null);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    isNearBottomRef.current = distanceFromBottom < 90;
  };

  const scrollToBottom = React.useCallback((behavior: ScrollBehavior = "smooth") => {
    if (!messagesContainerRef.current) return;
    messagesContainerRef.current.scrollTo({
      top: messagesContainerRef.current.scrollHeight,
      behavior,
    });
  }, []);

  // Only scroll down if user sent a message, switched contacts, or is already near the bottom
  React.useEffect(() => {
    if (shouldScrollToBottomRef.current || isNearBottomRef.current) {
      scrollToBottom(shouldScrollToBottomRef.current ? "auto" : "smooth");
      shouldScrollToBottomRef.current = false;
    }
  }, [messages, scrollToBottom]);

  // 1. Load Real Conversations ONLY (No sample/dummy conversations, Admin excluded for tourists)
  const loadContacts = React.useCallback(async () => {
    setIsLoadingContacts(true);
    try {
      const supabase = createClient();
      // Fetch all properties to resolve host property names accurately
      const { data: allProps } = await supabase
        .from("properties")
        .select("id, name, type, owner_id");

      const ownerPropertyMap = new Map<string, { name: string; type: string }>();
      ((allProps as any[]) || []).forEach((p: any) => {
        if (p.owner_id) {
          ownerPropertyMap.set(p.owner_id, { name: p.name, type: p.type });
        }
      });

      // If Admin: Fetch all registered homestay & resort owners for member directory & outreach
      if (currentRole === "admin") {
        const { data: hosts } = await (supabase.from("profiles") as any)
          .select("id, full_name, role, phone_number, email")
          .in("role", ["homestay", "resort"])
          .order("full_name", { ascending: true });

        if (hosts && hosts.length > 0) {
          setAvailableHosts(
            hosts.map((h: any) => {
              const propInfo = ownerPropertyMap.get(h.id);
              return {
                id: h.id,
                name: h.full_name || "Host",
                role: h.role,
                propertyName: propInfo?.name || (h.role === "resort" ? "Resort" : "Homestay"),
                phone: h.phone_number,
                email: h.email,
              };
            })
          );
        } else {
          // Fallback to registered Bretania accredited hosts
          setAvailableHosts([
            {
              id: "2853057a-9c5e-490e-8c3a-49330721b57b",
              name: "Maria Santos",
              role: "homestay",
              propertyName: "Poy-an Homestay",
              phone: "+63 912 000 0002",
              email: "homestay@mvba.test",
            },
            {
              id: "678e0d9b-640a-429a-8c90-ef07dc6d4567",
              name: "Bretania Sands Beach Resort",
              role: "resort",
              propertyName: "Bretania Sands Beach Resort",
              phone: "+63 912 345 6788",
              email: "resort@mvba.test",
            },
          ]);
        }
      }

      // If Host (Homestay / Resort): Fetch MVBA Association Admin profile for direct association channel
      if (currentRole === "homestay" || currentRole === "resort") {
        const { data: admins } = await (supabase.from("profiles") as any)
          .select("id, full_name, role, phone_number, email")
          .eq("role", "admin")
          .limit(1);

        if (admins && admins.length > 0) {
          const adm = admins[0];
          setAdminProfile({
            id: adm.id,
            name: adm.full_name ? `Admin (${adm.full_name})` : "MVBA Association Admin",
            role: "admin",
            propertyName: "MVBA Association Office",
            phone: adm.phone_number,
            email: adm.email,
          });
        } else {
          setAdminProfile({
            id: "c603667a-8f10-4951-88be-76b29c3fe068",
            name: "MVBA Association Admin",
            role: "admin",
            propertyName: "MVBA Association Office",
            phone: "+63 912 000 0001",
            email: "admin@mvba.test",
          });
        }
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();

      const effectiveUser =
        user ||
        (currentRole === "admin"
          ? { id: "c603667a-8f10-4951-88be-76b29c3fe068", email: "admin@mvba.test" }
          : { id: "2853057a-9c5e-490e-8c3a-49330721b57b", email: "homestay@mvba.test" });

      if (!effectiveUser) {
        setIsLoadingContacts(false);
        return;
      }
      setCurrentUser(effectiveUser);

      const contactMap = new Map<string, ChatContact>();

      // Query messages table for REAL conversation partners
      const { data: recentMsgs } = await supabase
        .from("messages")
        .select(`
          id,
          sender_id,
          receiver_id,
          content,
          is_read,
          created_at,
          sender:profiles!sender_id (id, full_name, role, phone_number),
          receiver:profiles!receiver_id (id, full_name, role, phone_number)
        `)
        .or(`sender_id.eq.${effectiveUser.id},receiver_id.eq.${effectiveUser.id}`)
        .order("created_at", { ascending: false });

      const partnerLatest = new Map<string, any>();
      const partnerUnreadCounts = new Map<string, number>();

      ((recentMsgs as any[]) || []).forEach((m: any) => {
        const partner = m.sender_id === effectiveUser.id ? m.receiver : m.sender;
        const partnerId = m.sender_id === effectiveUser.id ? m.receiver_id : m.sender_id;
        if (!partnerId || partnerId === effectiveUser.id) return;

        // RULE: Admin must NEVER show to communicate with tourists!
        if (currentRole === "tourist" && partner?.role === "admin") {
          return;
        }

        // RULE: Admin dashboard communicates exclusively with homestay/resort hosts!
        if (currentRole === "admin" && partner?.role === "tourist") {
          return;
        }

        // Count unread incoming messages where current user is the recipient
        if (m.receiver_id === effectiveUser.id && !m.is_read) {
          partnerUnreadCounts.set(
            partnerId,
            (partnerUnreadCounts.get(partnerId) || 0) + 1
          );
        }

        // The first message encountered in created_at DESC order is the latest message
        if (!partnerLatest.has(partnerId)) {
          partnerLatest.set(partnerId, {
            ...m,
            partner,
          });
        }
      });

      // Populate contacts ONLY from actual conversations
      partnerLatest.forEach((latest, partnerId) => {
        const partner = latest.partner;
        const propInfo = ownerPropertyMap.get(partnerId);
        const unreadCount = partnerUnreadCounts.get(partnerId) || 0;
        const isPartnerAdmin = partner?.role === "admin";

        contactMap.set(partnerId, {
          id: partnerId,
          name: isPartnerAdmin
            ? partner?.full_name ? `Admin (${partner.full_name})` : "MVBA Association Admin"
            : partner?.full_name || propInfo?.name || "Host",
          role: partner?.role || propInfo?.type || "homestay",
          propertyName: isPartnerAdmin
            ? "MVBA Association Office"
            : propInfo?.name,
          lastMessage: latest.content,
          lastTime: formatMessageTime(latest.created_at),
          lastMessageCreatedAt: latest.created_at,
          lastMessageSenderId: latest.sender_id,
          lastMessageIsRead: Boolean(latest.is_read),
          unreadCount,
          phone: partner?.phone_number,
        });
      });

      // Handle user explicitly initiating a conversation (e.g. clicking "Message Host" with ?recipient=... or ?guest=...)
      if (targetGuestId && !contactMap.has(targetGuestId)) {
        const { data: targetProfileData } = await (supabase.from("profiles") as any)
          .select("id, full_name, role, phone_number")
          .eq("id", targetGuestId)
          .single();

        const targetProfile = targetProfileData as any;
        if (targetProfile) {
          // Block tourist from starting chat with admin
          if (currentRole === "tourist" && targetProfile.role === "admin") {
            toast.error("Tourists communicate directly with homestay & resort hosts.");
          } else if (currentRole === "admin" && targetProfile.role === "tourist") {
            toast.error("Admin dashboard communicates directly with homestay & resort hosts.");
          } else {
            const propInfo = ownerPropertyMap.get(targetProfile.id);
            const isTargetAdmin = targetProfile.role === "admin";
            const newContact: ChatContact = {
              id: targetProfile.id,
              name: isTargetAdmin
                ? targetProfile.full_name ? `Admin (${targetProfile.full_name})` : "MVBA Association Admin"
                : targetProfile.full_name || propInfo?.name || "Host",
              role: targetProfile.role || propInfo?.type || "homestay",
              propertyName: isTargetAdmin ? "MVBA Association Office" : propInfo?.name,
              lastMessage: "Start a conversation...",
              lastTime: "New",
              lastMessageIsRead: true,
              unreadCount: 0,
              phone: targetProfile.phone_number,
            };
            contactMap.set(targetProfile.id, newContact);
          }
        }
      }

      // Sort contacts: unread messages first, then most recent message timestamp
      const list = Array.from(contactMap.values()).sort((a, b) => {
        if ((b.unreadCount || 0) !== (a.unreadCount || 0)) {
          return (b.unreadCount || 0) - (a.unreadCount || 0);
        }
        const timeA = a.lastMessageCreatedAt
          ? new Date(a.lastMessageCreatedAt).getTime()
          : 0;
        const timeB = b.lastMessageCreatedAt
          ? new Date(b.lastMessageCreatedAt).getTime()
          : 0;
        return timeB - timeA;
      });

      setContacts(list);

      // Auto-select target from URL or first conversation in list
      if (targetGuestId) {
        const found = list.find((c) => c.id === targetGuestId);
        if (found) {
          setActiveContact(found);
        } else if (list.length > 0) {
          if (window.innerWidth >= 768) {
            setActiveContact(list[0]);
          } else {
            setActiveContact(null);
          }
        } else {
          setActiveContact(null);
        }
      } else if (list.length > 0) {
        if (window.innerWidth >= 768) {
          setActiveContact(list[0]);
        } else {
          setActiveContact(null);
        }
      } else {
        setActiveContact(null);
      }
    } catch {
      // Ignored
    } finally {
      setIsLoadingContacts(false);
    }
  }, [currentRole, targetGuestId]);

  React.useEffect(() => {
    loadContacts();
  }, [loadContacts]);

  // 2. Select Contact Handler (Marks active contact read immediately like Messenger)
  const handleSelectContact = React.useCallback(
    async (contact: ChatContact) => {
      setActiveContact(contact);

      // Immediately clear unread highlight locally for this contact
      setContacts((prev) =>
        prev.map((c) =>
          c.id === contact.id
            ? { ...c, unreadCount: 0, lastMessageIsRead: true }
            : c
        )
      );

      // Update Supabase to mark all incoming messages from this partner as read
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (user && contact.id) {
          await (supabase.from("messages") as any)
            .update({ is_read: true })
            .eq("sender_id", contact.id)
            .eq("receiver_id", user.id)
            .eq("is_read", false);
        }
      } catch {
        // Ignored
      }
    },
    []
  );

  // Start or open a chat with a specific registered host (for Admin)
  const handleStartHostChat = React.useCallback(
    (host: any) => {
      setIsHostPickerOpen(false);
      const existing = contacts.find((c) => c.id === host.id);
      if (existing) {
        handleSelectContact(existing);
      } else {
        const newHostContact: ChatContact = {
          id: host.id,
          name: host.name,
          role: host.role,
          propertyName: host.propertyName,
          lastMessage: "Start a conversation...",
          lastTime: "New",
          lastMessageIsRead: true,
          unreadCount: 0,
          phone: host.phone,
        };
        setContacts((prev) => [newHostContact, ...prev.filter((c) => c.id !== host.id)]);
        setActiveContact(newHostContact);
        setMessages([]);
      }
    },
    [contacts, handleSelectContact]
  );

  // Start or open a chat with the Association Admin (for Homestay/Resort Owners)
  const handleStartAdminChat = React.useCallback(() => {
    if (!adminProfile) {
      toast.error("Association Admin channel is initializing. Please try again shortly.");
      return;
    }
    const existing = contacts.find((c) => c.id === adminProfile.id);
    if (existing) {
      handleSelectContact(existing);
    } else {
      const newAdminContact: ChatContact = {
        id: adminProfile.id,
        name: adminProfile.name,
        role: "admin",
        propertyName: adminProfile.propertyName,
        lastMessage: "Start official inquiry...",
        lastTime: "New",
        lastMessageIsRead: true,
        unreadCount: 0,
        phone: adminProfile.phone,
      };
      setContacts((prev) => [newAdminContact, ...prev.filter((c) => c.id !== adminProfile.id)]);
      setActiveContact(newAdminContact);
      setMessages([]);
    }
  }, [adminProfile, contacts, handleSelectContact]);

  // 3. Load Messages for Active Contact (No sample fallback messages)
  const loadMessages = React.useCallback(async (contactId: string) => {
    if (!contactId) return;
    setIsLoadingMessages(true);

    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const { data } = await supabase
          .from("messages")
          .select("*")
          .or(
            `and(sender_id.eq.${user.id},receiver_id.eq.${contactId}),and(sender_id.eq.${contactId},receiver_id.eq.${user.id})`
          )
          .order("created_at", { ascending: true });

        const msgList = (data as any[]) || [];
        setMessages(msgList);

        if (msgList.length > 0) {
          // Mark incoming unread messages from this contact as read in Supabase
          const unreadIds = msgList
            .filter(
              (m: any) =>
                m.sender_id === contactId &&
                m.receiver_id === user.id &&
                !m.is_read
            )
            .map((m: any) => m.id);

          if (unreadIds.length > 0) {
            await (supabase.from("messages") as any)
              .update({ is_read: true })
              .in("id", unreadIds);

            // Update contact in sidebar: remove unread highlight
            setContacts((prev) =>
              prev.map((c) =>
                c.id === contactId
                  ? { ...c, unreadCount: 0, lastMessageIsRead: true }
                  : c
              )
            );
          }
        }
      } else {
        setMessages([]);
      }
    } catch {
      setMessages([]);
    } finally {
      setIsLoadingMessages(false);
    }
  }, []);

  React.useEffect(() => {
    if (activeContact) {
      shouldScrollToBottomRef.current = true;
      loadMessages(activeContact.id);
    } else {
      setMessages([]);
    }
  }, [activeContact, loadMessages]);

  // 4. Supabase Realtime Subscription (Push updates when messages arrive or are read)
  React.useEffect(() => {
    if (!currentUser) return;
    const supabase = createClient();

    const channel = supabase
      .channel(`chat-realtime-${currentUser.id}`)
      .on(
        "postgres_changes",
        {
          event: "*", // Listen to INSERT (new message) and UPDATE (read receipts / Seen)
          schema: "public",
          table: "messages",
        },
        async (payload: any) => {
          const eventType = payload.eventType;
          const msg = (payload.new || payload.old) as ChatMessageItem;
          if (!msg) return;

          // Only process messages involving current user
          if (
            msg.sender_id !== currentUser.id &&
            msg.receiver_id !== currentUser.id
          ) {
            return;
          }

          const partnerId =
            msg.sender_id === currentUser.id
              ? msg.receiver_id
              : msg.sender_id;

          // If tourist, check if partner is admin
          if (currentRole === "tourist") {
            const { data: partnerProfData } = await (supabase.from("profiles") as any)
              .select("role")
              .eq("id", partnerId)
              .single();

            const partnerProf = partnerProfData as any;
            if (partnerProf?.role === "admin") {
              return; // Do not show admin message to tourist
            }
          }

          // If admin, check if partner is tourist
          if (currentRole === "admin") {
            const { data: partnerProfData } = await (supabase.from("profiles") as any)
              .select("role")
              .eq("id", partnerId)
              .single();

            const partnerProf = partnerProfData as any;
            if (partnerProf?.role === "tourist") {
              return; // Do not show tourist message to admin
            }
          }

          const isIncoming = msg.receiver_id === currentUser.id;
          const isViewingThis = activeContact?.id === partnerId;

          if (eventType === "INSERT") {
            // If message belongs to active open chat thread
            if (activeContact && partnerId === activeContact.id) {
              setMessages((prev) => {
                if (prev.some((m) => m.id === msg.id)) return prev;
                return [...prev, msg];
              });
              if (isIncoming) {
                (supabase.from("messages") as any)
                  .update({ is_read: true })
                  .eq("id", msg.id);
              }
            }

            // Update or add sidebar contact item
            setContacts((prev) => {
              const idx = prev.findIndex((c) => c.id === partnerId);
              if (idx !== -1) {
                const target = prev[idx];
                const updated: ChatContact = {
                  ...target,
                  lastMessage: msg.content,
                  lastTime: formatMessageTime(msg.created_at),
                  lastMessageSenderId: msg.sender_id,
                  lastMessageCreatedAt: msg.created_at,
                  lastMessageIsRead: isIncoming ? isViewingThis : false,
                  unreadCount:
                    isIncoming && !isViewingThis
                      ? (target.unreadCount || 0) + 1
                      : 0,
                };
                const remaining = prev.filter((c) => c.id !== partnerId);
                return [updated, ...remaining];
              }

              // If new conversation just arrived from someone, reload contacts cleanly
              loadContacts();
              return prev;
            });

            if (isIncoming && !isViewingThis) {
              toast.info(`New message: "${msg.content.slice(0, 35)}..."`);
            }
          }

          if (eventType === "UPDATE") {
            // Update message in active thread (Seen receipt flipped from false to true!)
            setMessages((prev) =>
              prev.map((m) => (m.id === msg.id ? { ...m, is_read: msg.is_read } : m))
            );

            // Update contact in sidebar
            setContacts((prev) =>
              prev.map((c) => {
                if (c.id === partnerId) {
                  return {
                    ...c,
                    lastMessageIsRead: msg.is_read,
                    unreadCount:
                      msg.receiver_id === currentUser.id && msg.is_read
                        ? 0
                        : c.unreadCount,
                  };
                }
                return c;
              })
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUser, activeContact, currentRole, loadContacts]);

  // 5. Polling Realtime Fallback (Syncs every 3s across active thread and all contacts)
  React.useEffect(() => {
    if (!currentUser) return;

    const interval = setInterval(async () => {
      try {
        const supabase = createClient();

        // A. If an active contact is selected, sync thread messages & seen receipts
        if (activeContact) {
          const { data } = await supabase
            .from("messages")
            .select("*")
            .or(
              `and(sender_id.eq.${currentUser.id},receiver_id.eq.${activeContact.id}),and(sender_id.eq.${activeContact.id},receiver_id.eq.${currentUser.id})`
            )
            .order("created_at", { ascending: true });

          const msgList = (data as any[]) || [];
          if (msgList.length > 0) {
            setMessages((prev) => {
              if (
                prev.length === msgList.length &&
                prev[prev.length - 1]?.id === msgList[msgList.length - 1]?.id &&
                prev[prev.length - 1]?.is_read === msgList[msgList.length - 1]?.is_read
              ) {
                return prev;
              }
              return msgList;
            });

            // Mark any unread incoming messages as read
            const unreadIds = msgList
              .filter(
                (m) =>
                  m.sender_id === activeContact.id &&
                  m.receiver_id === currentUser.id &&
                  !m.is_read
              )
              .map((m) => m.id);

            if (unreadIds.length > 0) {
              (supabase.from("messages") as any)
                .update({ is_read: true })
                .in("id", unreadIds);
            }

            // Sync sidebar last message for the active contact
            const latest = msgList[msgList.length - 1];
            setContacts((prev) => {
              const idx = prev.findIndex((c) => c.id === activeContact.id);
              if (idx === -1) return prev;
              const cur = prev[idx];
              if (
                cur.lastMessage === latest.content &&
                cur.lastMessageCreatedAt === latest.created_at &&
                cur.lastMessageIsRead === latest.is_read
              ) {
                return prev;
              }
              const updated: ChatContact = {
                ...cur,
                lastMessage: latest.content,
                lastTime: formatMessageTime(latest.created_at),
                lastMessageSenderId: latest.sender_id,
                lastMessageCreatedAt: latest.created_at,
                lastMessageIsRead: latest.sender_id === currentUser.id ? latest.is_read : true,
                unreadCount: 0,
              };
              return [updated, ...prev.filter((c) => c.id !== activeContact.id)];
            });
          }
        }

        // B. Check recent incoming messages across ALL contacts to detect unread messages from others
        const { data: allRecent } = await supabase
          .from("messages")
          .select(`
            id,
            sender_id,
            receiver_id,
            content,
            is_read,
            created_at,
            sender:profiles!sender_id (id, full_name, role)
          `)
          .or(`receiver_id.eq.${currentUser.id},sender_id.eq.${currentUser.id}`)
          .order("created_at", { ascending: false })
          .limit(25);

        if (allRecent && allRecent.length > 0) {
          // If tourist, filter out admin messages; if admin, filter out tourist messages
          const filteredRecent = (allRecent as any[]).filter((msg: any) => {
            const senderRole = msg.sender?.role;
            if (currentRole === "tourist" && senderRole === "admin") return false;
            if (currentRole === "admin" && senderRole === "tourist") return false;
            return true;
          });

          setContacts((prev) => {
            let changed = false;
            const updated = [...prev];

            filteredRecent.forEach((msg: any) => {
              const partnerId =
                msg.sender_id === currentUser.id
                  ? msg.receiver_id
                  : msg.sender_id;
              const idx = updated.findIndex((c) => c.id === partnerId);
              if (idx !== -1) {
                const contact = updated[idx];
                const msgTime = new Date(msg.created_at).getTime();
                const contactTime = contact.lastMessageCreatedAt
                  ? new Date(contact.lastMessageCreatedAt).getTime()
                  : 0;

                if (msgTime > contactTime || contact.lastMessageIsRead !== msg.is_read) {
                  changed = true;
                  const isViewing = activeContact?.id === partnerId;
                  const isIncoming = msg.receiver_id === currentUser.id;
                  updated[idx] = {
                    ...contact,
                    lastMessage: msg.content,
                    lastTime: formatMessageTime(msg.created_at),
                    lastMessageSenderId: msg.sender_id,
                    lastMessageCreatedAt: msg.created_at,
                    lastMessageIsRead: isIncoming ? isViewing || msg.is_read : msg.is_read,
                    unreadCount:
                      isIncoming && !isViewing && !msg.is_read
                        ? (contact.unreadCount || 0) + 1
                        : isViewing
                        ? 0
                        : contact.unreadCount,
                  };
                }
              }
            });

            if (!changed) return prev;

            return updated.sort((a, b) => {
              if ((b.unreadCount || 0) !== (a.unreadCount || 0)) {
                return (b.unreadCount || 0) - (a.unreadCount || 0);
              }
              const timeA = a.lastMessageCreatedAt
                ? new Date(a.lastMessageCreatedAt).getTime()
                : 0;
              const timeB = b.lastMessageCreatedAt
                ? new Date(b.lastMessageCreatedAt).getTime()
                : 0;
              return timeB - timeA;
            });
          });
        }
      } catch {
        // Ignored
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [currentUser, activeContact, currentRole]);

  // 6. Send Message Handler
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !activeContact) return;

    const text = inputText.trim();
    setInputText("");
    setIsSending(true);

    const nowIso = new Date().toISOString();
    const tempId = "msg-" + Date.now();
    const optimisticMsg: ChatMessageItem = {
      id: tempId,
      sender_id: currentUser?.id || "me",
      receiver_id: activeContact.id,
      content: text,
      created_at: nowIso,
      is_read: false, // Not read yet by recipient
    };

    // Immediate UI feedback & force scroll to bottom on own sent message
    shouldScrollToBottomRef.current = true;
    setMessages((prev) => [...prev, optimisticMsg]);

    // Update contact list immediately: preview shows "You: ..." with unread by recipient status
    setContacts((prev) => {
      const idx = prev.findIndex((c) => c.id === activeContact.id);
      if (idx === -1) {
        // First message in a newly started conversation: add to list at top
        const created: ChatContact = {
          ...activeContact,
          lastMessage: text,
          lastTime: "Just now",
          lastMessageSenderId: currentUser?.id,
          lastMessageCreatedAt: nowIso,
          lastMessageIsRead: false,
          unreadCount: 0,
        };
        return [created, ...prev];
      }
      const cur = prev[idx];
      const updated: ChatContact = {
        ...cur,
        lastMessage: text,
        lastTime: "Just now",
        lastMessageSenderId: currentUser?.id,
        lastMessageCreatedAt: nowIso,
        lastMessageIsRead: false,
        unreadCount: 0,
      };
      return [updated, ...prev.filter((c) => c.id !== activeContact.id)];
    });

    try {
      const supabase = createClient();
      if (currentUser && activeContact.id) {
        await (supabase.from("messages") as any).insert({
          sender_id: currentUser.id,
          receiver_id: activeContact.id,
          content: text,
          is_read: false,
        });
      }
    } catch {
      // Local optimistic fallback
    } finally {
      setIsSending(false);
    }
  };

  const filteredContacts = contacts.filter(
    (c) =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.propertyName &&
        c.propertyName.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const filteredAvailableHosts = availableHosts.filter((h) => {
    const q = hostPickerSearch.trim().toLowerCase();
    if (!q) return true;
    return (
      (h.name && h.name.toLowerCase().includes(q)) ||
      (h.propertyName && h.propertyName.toLowerCase().includes(q)) ||
      (h.role && h.role.toLowerCase().includes(q))
    );
  });

  const totalUnread = contacts.reduce(
    (acc, c) => acc + (c.unreadCount || 0),
    0
  );

  return (
    <div className="space-y-4">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-neutral-200 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900 tracking-tight">
            {portalTitle}
          </h1>
          <p className="text-sm sm:text-base text-neutral-600 mt-0.5 font-medium">
            {portalSubtitle}
          </p>
        </div>

        <button
          onClick={() => {
            loadContacts();
            if (activeContact) loadMessages(activeContact.id);
            toast.success("Messages synchronized");
          }}
          className="flex items-center gap-1.5 text-xs font-semibold text-neutral-600 hover:text-black self-start sm:self-auto px-3 py-1.5 rounded-lg border border-neutral-200 bg-white hover:bg-neutral-50"
        >
          <RefreshCw
            className={`h-3.5 w-3.5 ${isLoadingContacts ? "animate-spin" : ""}`}
          />
          <span>Refresh Inbox</span>
        </button>
      </div>

      {/* Main Chat Grid (Sidebar + Message Thread) */}
      <div className="rounded-2xl border border-neutral-200 bg-white shadow-xs overflow-hidden grid grid-cols-1 md:grid-cols-12 h-[calc(100vh-13.5rem)] min-h-[520px] max-h-[850px]">
        {/* Left: Conversations List (md:col-span-5 lg:col-span-4) */}
        <div className={cn(
          "md:col-span-5 lg:col-span-4 border-r border-neutral-200 flex-col bg-neutral-50/50 h-full min-h-0 overflow-hidden",
          activeContact ? "hidden md:flex" : "flex"
        )}>
          {/* Search Contacts Bar */}
          <div className="p-3.5 border-b border-neutral-200 bg-white shrink-0">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-neutral-500" />
              <input
                type="text"
                placeholder="Search conversations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-9 pl-9 pr-3 rounded-xl border border-neutral-200 text-sm font-medium text-neutral-900 placeholder:text-neutral-500 focus:outline-none focus:ring-1 focus:ring-black bg-neutral-50"
              />
            </div>
          </div>

          {/* Admin Quick Action: Message a Host */}
          {currentRole === "admin" && (
            <div className="px-3.5 py-2.5 bg-white border-b border-neutral-100 shrink-0">
              <button
                type="button"
                onClick={() => setIsHostPickerOpen(true)}
                className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold bg-black hover:bg-neutral-800 text-white transition-all shadow-xs cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Message Property Host</span>
              </button>
            </div>
          )}

          {/* Homestay / Resort Host Quick Action: Contact Association Admin */}
          {(currentRole === "homestay" || currentRole === "resort") && (
            <div className="px-3.5 py-2.5 bg-white border-b border-neutral-100 shrink-0">
              <button
                type="button"
                onClick={handleStartAdminChat}
                className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold bg-amber-50 hover:bg-amber-100/80 text-amber-950 border border-amber-200/80 transition-all cursor-pointer group shadow-2xs"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div className="h-7 w-7 rounded-lg bg-amber-500 text-white flex items-center justify-center font-bold text-xs shadow-2xs shrink-0">
                    <ShieldCheck className="h-4 w-4" />
                  </div>
                  <div className="text-left min-w-0">
                    <p className="font-bold text-neutral-900 leading-tight truncate">MVBA Association Admin</p>
                    <p className="text-[10px] text-amber-800 font-medium truncate">Official notices, dues & permits</p>
                  </div>
                </div>
                <span className="text-[10px] font-bold text-amber-800 bg-amber-200/60 px-2 py-0.5 rounded-md group-hover:bg-amber-200 shrink-0">
                  Contact
                </span>
              </button>
            </div>
          )}

          {/* Conversations Section Header with Total Unread Indicator */}
          <div className="flex items-center justify-between px-4 py-2 border-b border-neutral-100 bg-neutral-50/80 shrink-0">
            <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-600">
              Conversations
            </span>
            {totalUnread > 0 ? (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-black bg-blue-600 text-white shadow-2xs animate-pulse">
                <span className="h-1.5 w-1.5 rounded-full bg-white" />
                {totalUnread} Unread
              </span>
            ) : (
              <span className="text-[10px] font-medium text-neutral-500">
                {contacts.length} {contacts.length === 1 ? "chat" : "chats"}
              </span>
            )}
          </div>

          {/* Contacts Scroll List */}
          <div className="flex-1 overflow-y-auto divide-y divide-neutral-100 p-1.5 min-h-0 space-y-1">
            {isLoadingContacts ? (
              <div className="p-8 text-center text-xs text-neutral-500 space-y-2">
                <Loader2 className="h-5 w-5 animate-spin mx-auto text-neutral-500" />
                <span>Loading conversations...</span>
              </div>
            ) : filteredContacts.length === 0 ? (
              <div className="p-8 text-center text-xs text-neutral-500 space-y-3">
                <div className="h-12 w-12 rounded-2xl bg-neutral-200/60 flex items-center justify-center mx-auto">
                  <MessageSquare className="h-6 w-6 text-neutral-500" />
                </div>
                <p className="text-base font-bold text-neutral-700">No active conversations</p>
                <p className="text-sm mt-1 text-neutral-500 leading-relaxed max-w-[200px] mx-auto">
                  {currentRole === "tourist"
                    ? "When you message a homestay or resort host, your conversations will appear here."
                    : currentRole === "admin"
                    ? "When resort/homestay owners message the association, or when you initiate a message, conversations will appear here."
                    : "When guests or the association admin message you, your conversations will appear here."}
                </p>
                {currentRole === "tourist" && (
                  <Link href="/explore" className="inline-block pt-1">
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs h-8 px-3 font-semibold rounded-lg border-neutral-300"
                    >
                      Browse Stays to Message
                    </Button>
                  </Link>
                )}
                {currentRole === "admin" && (
                  <div className="pt-1">
                    <Button
                      type="button"
                      onClick={() => setIsHostPickerOpen(true)}
                      size="sm"
                      className="text-xs h-8 px-3 font-semibold rounded-lg bg-black text-white hover:bg-neutral-800 cursor-pointer"
                    >
                      <Plus className="h-3.5 w-3.5 mr-1" />
                      Message a Host
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              filteredContacts.map((contact) => {
                const isSelected = activeContact?.id === contact.id;
                const isSentByMe = Boolean(
                  contact.lastMessageSenderId &&
                    contact.lastMessageSenderId === (currentUser?.id || "me")
                );

                // Highlight rule: Only highlight if NOT read by recipient (like Messenger!)
                const isUnreadByMe =
                  !isSentByMe &&
                  ((contact.unreadCount && contact.unreadCount > 0) ||
                    contact.lastMessageIsRead === false);

                const isSeenByRecipient =
                  isSentByMe && contact.lastMessageIsRead === true;

                return (
                  <button
                    key={contact.id}
                    onClick={() => handleSelectContact(contact)}
                    className={`w-full text-left p-3.5 transition-all flex items-start gap-3 relative rounded-xl my-0.5 ${
                      isSelected
                        ? "bg-black text-white shadow-xs"
                        : isUnreadByMe
                        ? "bg-blue-50/70 hover:bg-blue-100/70 text-neutral-900 border-l-4 border-l-blue-600 shadow-2xs"
                        : "hover:bg-neutral-100/80 text-neutral-800"
                    }`}
                  >
                    {/* Contact Avatar with Messenger-style Unread Status */}
                    <div className="relative shrink-0 mt-0.5">
                      <div
                        className={`flex h-10 w-10 items-center justify-center rounded-xl font-bold text-xs shadow-2xs ${
                          isSelected
                            ? "bg-white text-black"
                            : contact.role === "admin"
                            ? "bg-amber-500 text-white font-black"
                            : isUnreadByMe
                            ? "bg-blue-600 text-white font-black"
                            : "bg-neutral-200 text-neutral-800"
                        }`}
                      >
                        {contact.role === "admin" ? (
                          <ShieldCheck className="h-5 w-5 text-white" />
                        ) : (
                          contact.name.slice(0, 2).toUpperCase()
                        )}
                      </div>

                      {/* Messenger unread indicator dot on avatar */}
                      {isUnreadByMe && !isSelected && (
                        <span className="absolute -top-1 -right-1 flex h-3 w-3">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                          <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-600 border-2 border-white ring-1 ring-blue-500" />
                        </span>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      {/* Name & Time */}
                      <div className="flex items-center justify-between gap-1">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <h4
                            className={`text-xs truncate leading-snug ${
                              isSelected
                                ? "font-bold text-white"
                                : isUnreadByMe
                                ? "font-black text-neutral-950"
                                : "font-semibold text-neutral-800"
                            }`}
                          >
                            {contact.name}
                          </h4>
                          {contact.role === "admin" && (
                            <span
                              className={`text-[9px] font-bold px-1.5 py-0.2 rounded-sm uppercase tracking-wider shrink-0 ${
                                isSelected
                                  ? "bg-white/20 text-white"
                                  : "bg-amber-100 text-amber-900 border border-amber-300"
                              }`}
                            >
                              OFFICIAL
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <span
                            className={`text-[10px] font-mono shrink-0 ${
                              isSelected
                                ? "text-neutral-300 font-medium"
                                : isUnreadByMe
                                ? "text-blue-700 font-bold"
                                : "text-neutral-500 font-normal"
                            }`}
                          >
                            {contact.lastTime}
                          </span>

                          {/* Messenger solid blue unread dot on right side */}
                          {isUnreadByMe && !isSelected && (
                            <span
                              title="Unread message"
                              className="h-2.5 w-2.5 rounded-full bg-blue-600 shrink-0 ring-2 ring-blue-100 shadow-xs"
                            />
                          )}
                        </div>
                      </div>

                      {/* Property Name (e.g. Poy-an Homestay) */}
                      {contact.propertyName && (
                        <p
                          className={`text-[11px] truncate mt-0.5 ${
                            isSelected
                              ? "text-neutral-300 font-medium"
                              : isUnreadByMe
                              ? "text-neutral-800 font-semibold"
                              : "text-neutral-600 font-normal"
                          }`}
                        >
                          {contact.propertyName}
                        </p>
                      )}

                      {/* Message Snippet below Property Name */}
                      {isUnreadByMe ? (
                        /* UNREAD BY RECIPIENT: Highlighted in bold dark text with NEW badge */
                        <div className="mt-1 flex items-center justify-between gap-1">
                          <p
                            className={`text-xs truncate flex-1 ${
                              isSelected
                                ? "text-white font-bold"
                                : "text-neutral-950 font-black"
                            }`}
                          >
                            {contact.lastMessage}
                          </p>
                          {!isSelected && (
                            <span className="inline-flex items-center px-1.5 py-0.2 rounded-full text-[9px] font-black uppercase tracking-wider bg-blue-600 text-white shrink-0 shadow-2xs">
                              NEW
                            </span>
                          )}
                        </div>
                      ) : isSentByMe ? (
                        /* SENT BY CURRENT USER: Shows whether recipient has read it or not */
                        <div className="mt-1 flex items-center justify-between gap-1 text-xs">
                          <p
                            className={`truncate flex-1 ${
                              isSelected
                                ? "text-neutral-300 font-normal"
                                : "text-neutral-600 font-normal"
                            }`}
                          >
                            <span
                              className={
                                isSelected
                                  ? "text-neutral-500"
                                  : "text-neutral-500"
                              }
                            >
                              You:{" "}
                            </span>
                            {contact.lastMessage}
                          </p>

                          {isSeenByRecipient ? (
                            /* Recipient HAS read your message */
                            <span
                              className="flex items-center gap-0.5 text-[10px] font-semibold text-emerald-600 shrink-0"
                              title="Seen by recipient"
                            >
                              <CheckCheck className="h-3 w-3 text-emerald-600" />
                              <span className="hidden sm:inline">Seen</span>
                            </span>
                          ) : (
                            /* Recipient has NOT read your message yet */
                            <span
                              className="flex items-center gap-0.5 text-[10px] font-medium text-neutral-500 shrink-0"
                              title="Delivered • Not read yet by recipient"
                            >
                              <Check className="h-3 w-3 text-neutral-500" />
                              <span className="hidden sm:inline">Delivered</span>
                            </span>
                          )}
                        </div>
                      ) : (
                        /* READ BY ME: Standard unhighlighted text (like Messenger read message) */
                        <p
                          className={`text-xs truncate mt-1 ${
                            isSelected
                              ? "text-neutral-300 font-normal"
                              : "text-neutral-600 font-normal"
                          }`}
                        >
                          {contact.lastMessage}
                        </p>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right: Active Message Thread Window */}
        {(() => {
          const threadContent = activeContact ? (
            <>
              {/* Thread Header (Messenger Style) */}
              <div className="pt-[max(env(safe-area-inset-top),0.5rem)] px-3 pb-3 border-b border-neutral-100 bg-white/95 backdrop-blur-md flex items-center justify-between shrink-0 z-10 shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <button 
                    onClick={() => setActiveContact(null)}
                    className="md:hidden p-2 -ml-1 text-neutral-500 hover:text-black rounded-full active:bg-neutral-100 transition-colors"
                    aria-label="Back to conversations"
                  >
                    <ChevronLeft className="h-7 w-7" />
                  </button>
                  <div
                    className={`relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-bold text-sm shadow-sm border border-neutral-100 ${
                      activeContact.role === "admin"
                        ? "bg-amber-500 text-white"
                        : "bg-black text-white"
                    }`}
                  >
                    {activeContact.role === "admin" ? (
                      <ShieldCheck className="h-5 w-5 text-white" />
                    ) : (
                      activeContact.name.slice(0, 2).toUpperCase()
                    )}
                    <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-emerald-500 border-2 border-white ring-1 ring-black/5" />
                  </div>
                  <div className="flex-1 min-w-0 pr-2">
                    <h3 className="text-[15px] font-bold text-neutral-900 leading-tight truncate">
                      {activeContact.name}
                    </h3>
                    <p className="text-[11px] text-neutral-500 flex items-center gap-1.5 mt-0.5 truncate">
                      {activeContact.role === "admin" ? (
                        <span className="font-semibold text-amber-600">Official Admin</span>
                      ) : activeContact.role === "tourist" ? (
                        <span>Tourist</span>
                      ) : (
                        <span className="capitalize">{activeContact.role} Owner</span>
                      )}
                      {activeContact.propertyName && (
                        <>
                          <span className="text-neutral-300">•</span>
                          <span className="truncate">{activeContact.propertyName}</span>
                        </>
                      )}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {activeContact.phone && (
                    <a href={`tel:${activeContact.phone}`} className="p-2 text-blue-500 hover:bg-blue-50 rounded-full transition-colors">
                      <Phone className="h-5 w-5 fill-current" />
                    </a>
                  )}
                  {activeContact.roomName && (
                    <Badge
                      variant="secondary"
                      size="sm"
                      className="hidden sm:inline-flex"
                    >
                      {activeContact.roomName}
                    </Badge>
                  )}
                </div>
              </div>

              {/* Messages Container */}
              <div
                ref={messagesContainerRef}
                onScroll={handleScroll}
                className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 bg-white min-h-0 overscroll-contain"
              >
                {isLoadingMessages ? (
                  <div className="py-12 text-center text-xs text-neutral-500 space-y-2">
                    <Loader2 className="h-5 w-5 animate-spin mx-auto text-neutral-500" />
                    <span>Loading conversation history...</span>
                  </div>
                ) : messages.length === 0 ? (
                  <div className="py-16 text-center text-xs text-neutral-500 space-y-2">
                    <MessageSquare className="h-8 w-8 mx-auto text-neutral-300" />
                    <p className="font-bold text-neutral-700">No messages yet</p>
                    <p className="text-neutral-600">
                      Send a message below to start coordinating with {activeContact.name}!
                    </p>
                  </div>
                ) : (
                  messages.map((msg) => {
                    const isSelf =
                      msg.sender_id === (currentUser?.id || "me") ||
                      msg.sender_id === "owner-me" ||
                      msg.sender_id === "tourist-me";

                    const time = new Date(msg.created_at).toLocaleTimeString(
                      [],
                      {
                        hour: "2-digit",
                        minute: "2-digit",
                      }
                    );

                    return (
                      <div
                        key={msg.id}
                        className={`flex items-end gap-2 mb-1 ${
                          isSelf ? "justify-end pl-12" : "justify-start pr-12"
                        }`}
                      >
                        {!isSelf && (
                          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-neutral-200 text-neutral-600 text-[10px] font-bold shrink-0 mb-1">
                            {activeContact.name.slice(0, 2).toUpperCase()}
                          </div>
                        )}

                        <div
                          className={`max-w-md px-4 py-2.5 text-[15px] shadow-sm leading-relaxed ${
                            isSelf
                              ? "bg-blue-600 text-white rounded-[20px] rounded-br-[4px]"
                              : "bg-[#E4E6EB] text-black rounded-[20px] rounded-bl-[4px]"
                          }`}
                        >
                          <p>{msg.content}</p>
                          <div
                            className={`flex items-center justify-end gap-1 text-[9px] mt-0.5 ${
                              isSelf ? "text-blue-100" : "text-neutral-500"
                            }`}
                          >
                            <span>{time}</span>
                            {isSelf && (
                              msg.is_read ? (
                                <span className="flex items-center" title="Seen by recipient">
                                  <CheckCheck className="h-3 w-3" />
                                </span>
                              ) : (
                                <span className="flex items-center opacity-70" title="Delivered • Not read yet">
                                  <Check className="h-3 w-3" />
                                </span>
                              )
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Bottom Input Bar */}
              <form
                onSubmit={handleSendMessage}
                className="p-3 pb-[max(env(safe-area-inset-bottom),0.75rem)] border-t border-neutral-100 bg-white flex items-center gap-2 shrink-0 z-10"
              >
                <button
                  type="button"
                  onClick={() => toast.info("Image upload coming soon!")}
                  className="p-2 text-blue-600 hover:bg-blue-50 rounded-full transition-colors shrink-0"
                  aria-label="Add attachment"
                >
                  <Plus className="h-6 w-6" />
                </button>
                <div className="flex-1 relative flex items-center">
                  <input
                    type="text"
                    placeholder="Aa"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    className="w-full h-10 pl-4 pr-10 rounded-full border-none bg-neutral-100 text-[15px] text-black placeholder:text-neutral-500 focus:outline-none focus:ring-1 focus:ring-blue-600 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => toast.info("Stickers coming soon!")}
                    className="absolute right-2 p-1.5 text-blue-600 rounded-full hover:bg-blue-50 transition-colors"
                  >
                    <Sparkles className="h-5 w-5" />
                  </button>
                </div>
                <button
                  type="submit"
                  disabled={!inputText.trim() || isSending}
                  className={`p-2 rounded-full transition-all shrink-0 ${
                    inputText.trim() && !isSending
                      ? "text-blue-600 hover:bg-blue-50"
                      : "text-neutral-300"
                  }`}
                  aria-label="Send message"
                >
                  {isSending ? (
                    <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                  ) : (
                    <Send className="h-6 w-6" />
                  )}
                </button>
              </form>
            </>
          ) : null;

          const emptyState = (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-neutral-500 space-y-3">
              <div className="h-20 w-20 rounded-2xl bg-neutral-100 flex items-center justify-center">
                <MessageSquare className="h-10 w-10 text-neutral-500" />
              </div>
              <div>
                <h3 className="font-bold text-base text-neutral-800">No conversation selected</h3>
                <p className="text-sm text-neutral-600 mt-2 max-w-sm leading-relaxed">
                  {currentRole === "tourist"
                    ? "Pick a conversation from the left, or visit a homestay/resort page to message a host directly."
                    : currentRole === "admin"
                    ? "Select a host conversation from the left, or click 'Message Property Host' to contact an accredited resort or homestay owner."
                    : "Select a conversation from the left panel, or click 'Contact Association Admin' to communicate directly with MVBA leadership."}
                </p>
              </div>
              {currentRole === "tourist" && (
                <Link href="/explore" className="pt-2">
                  <Button size="sm" className="text-sm bg-black text-white font-bold h-10 px-5 rounded-xl shadow-xs">
                    Explore Stays
                  </Button>
                </Link>
              )}
              {currentRole === "admin" && (
                <div className="pt-2">
                  <Button
                    type="button"
                    onClick={() => setIsHostPickerOpen(true)}
                    size="sm"
                    className="text-xs bg-black text-white font-bold h-9 px-4 rounded-xl shadow-xs cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5 mr-1.5" />
                    Message Property Host
                  </Button>
                </div>
              )}
            </div>
          );

          if (isMobile) {
            return (
              <AnimatePresence>
                {activeContact && (
                  <motion.div
                    initial={{ x: "100%" }}
                    animate={{ x: 0 }}
                    exit={{ x: "100%" }}
                    transition={{ type: "spring", bounce: 0, duration: 0.35 }}
                    drag="x"
                    dragConstraints={{ left: 0, right: 0 }}
                    dragElastic={{ left: 0, right: 1 }}
                    onDragEnd={(e, info) => {
                      if (info.offset.x > 75 && info.velocity.x > 20) {
                        setActiveContact(null);
                      }
                    }}
                    className="fixed inset-0 z-[100] h-[100dvh] w-screen bg-white flex flex-col"
                  >
                    {threadContent}
                  </motion.div>
                )}
              </AnimatePresence>
            );
          }

          return (
            <div className="hidden md:flex md:col-span-7 lg:col-span-8 flex-col bg-white h-full min-h-0 overflow-hidden border-l border-neutral-200">
              {activeContact ? threadContent : emptyState}
            </div>
          );
        })()}
      </div>

      {/* Admin Host Directory Modal */}
      {isHostPickerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl border border-neutral-200 shadow-xl max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="p-4 border-b border-neutral-100 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm text-neutral-900">Message Property Host</h3>
                <p className="text-xs text-neutral-600 mt-0.5">Start an official communication with an accredited owner</p>
              </div>
              <button
                type="button"
                onClick={() => setIsHostPickerOpen(false)}
                className="p-1.5 rounded-lg hover:bg-neutral-100 text-neutral-500 hover:text-neutral-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-3 border-b border-neutral-100 bg-neutral-50/50">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-neutral-500" />
                <input
                  type="text"
                  placeholder="Search hosts by name or property..."
                  value={hostPickerSearch}
                  onChange={(e) => setHostPickerSearch(e.target.value)}
                  className="w-full h-8 pl-9 pr-3 rounded-lg border border-neutral-200 bg-white text-xs text-neutral-900 focus:outline-none focus:ring-1 focus:ring-black"
                />
              </div>
            </div>

            <div className="max-h-72 overflow-y-auto p-2 space-y-1 divide-y divide-neutral-100">
              {filteredAvailableHosts.length === 0 ? (
                <div className="p-8 text-center text-xs text-neutral-500 space-y-1">
                  <p className="font-semibold text-neutral-600">No hosts found</p>
                  <p className="text-[11px]">No registered homestay or resort owners matching search</p>
                </div>
              ) : (
                filteredAvailableHosts.map((host) => (
                  <button
                    key={host.id}
                    type="button"
                    onClick={() => handleStartHostChat(host)}
                    className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-neutral-50 text-left transition-colors group cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="h-8 w-8 rounded-lg bg-neutral-900 text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-2xs">
                        {host.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-neutral-900 truncate">{host.name}</p>
                        <p className="text-[11px] text-neutral-600 truncate">{host.propertyName}</p>
                      </div>
                    </div>
                    <Badge variant="subtle" size="sm" className="capitalize text-[10px] shrink-0 font-semibold">
                      {host.role}
                    </Badge>
                  </button>
                ))
              )}
            </div>

            <div className="p-3 bg-neutral-50 border-t border-neutral-100 flex justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsHostPickerOpen(false)}
                className="text-xs font-semibold"
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function ConnectedChatSystem(props: ConnectedChatSystemProps) {
  return (
    <React.Suspense
      fallback={
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <LoadingLogo size="large" className="mb-4" />
          <p className="text-sm font-medium text-neutral-500">Loading messages...</p>
        </div>
      }
    >
      <ChatSystemContent {...props} />
    </React.Suspense>
  );
}
