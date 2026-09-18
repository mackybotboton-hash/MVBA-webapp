import { useEffect, useState, useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { RealtimeChannel } from "@supabase/supabase-js";

export interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  booking_id: string | null;
  content: string;
  is_read: boolean;
  created_at: string;
}

export function useRealtimeMessages(userId: string | undefined, initialMessages: Message[] = []) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const supabase = useMemo(() => createClient(), []);

  // Update isolated state without forcing full parent reload for every keystroke
  const handleNewMessage = useCallback((payload: any) => {
    const newMessage = payload.new as Message;
    setMessages((prev) => {
      // Prevent duplicates in strict mode
      if (prev.some((m) => m.id === newMessage.id)) return prev;
      return [...prev, newMessage].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    });
  }, []);

  const handleUpdateMessage = useCallback((payload: any) => {
    const updatedMessage = payload.new as Message;
    setMessages((prev) => 
      prev.map((msg) => (msg.id === updatedMessage.id ? updatedMessage : msg))
    );
  }, []);

  useEffect(() => {
    if (!userId) return;

    // Isolate subscription to only the current user's messages to save bandwidth
    const channel: RealtimeChannel = supabase
      .channel(`messages_for_${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `receiver_id=eq.${userId}`,
        },
        handleNewMessage
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `sender_id=eq.${userId}`,
        },
        handleNewMessage
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "messages",
          filter: `receiver_id=eq.${userId}`,
        },
        handleUpdateMessage
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log(`[Realtime] Subscribed to messages for user ${userId}`);
        }
      });

    // Strict cleanup to prevent zombie connections and memory leaks on unmount
    return () => {
      console.log(`[Realtime] Unsubscribing from messages for user ${userId}`);
      supabase.removeChannel(channel);
    };
  }, [userId, supabase, handleNewMessage, handleUpdateMessage]);

  const sendMessage = useCallback(async (receiverId: string, content: string, bookingId?: string) => {
    if (!userId) throw new Error("Not authenticated");

    const { data: rawData, error } = await supabase
      .from("messages")
      .insert({
        sender_id: userId,
        receiver_id: receiverId,
        content,
        booking_id: bookingId || null
      } as any)
      .select()
      .single();
    const data = rawData as any;

    if (error) throw error;
    return data;
  }, [userId, supabase]);

  const markAsRead = useCallback(async (messageId: string) => {
    const { error } = await supabase
      .from("messages")
      .update({ is_read: true } as any)
      .eq("id", messageId);

    if (error) throw error;
  }, [supabase]);

  return {
    messages,
    sendMessage,
    markAsRead
  };
}
