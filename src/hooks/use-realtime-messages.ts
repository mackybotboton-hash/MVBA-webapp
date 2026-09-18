import { useEffect, useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { RealtimeChannel } from "@supabase/supabase-js";
import { useQuery, useQueryClient } from "@tanstack/react-query";

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
  const queryClient = useQueryClient();
  const supabase = useMemo(() => createClient(), []);

  // 1. Initial Historical Fetch using React Query
  const { data: messages = initialMessages, isLoading } = useQuery({
    queryKey: ["messages", userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data || []) as Message[];
    },
    enabled: !!userId,
  });

  // Update isolated state using setQueryData
  const handleNewMessage = useCallback((payload: any) => {
    const newMessage = payload.new as Message;
    queryClient.setQueryData(["messages", userId], (oldData: Message[] | undefined) => {
      if (!oldData) return [newMessage];
      if (oldData.some((m) => m.id === newMessage.id)) return oldData;
      return [...oldData, newMessage].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    });
  }, [queryClient, userId]);

  const handleUpdateMessage = useCallback((payload: any) => {
    const updatedMessage = payload.new as Message;
    queryClient.setQueryData(["messages", userId], (oldData: Message[] | undefined) => {
      if (!oldData) return [];
      return oldData.map((msg) => (msg.id === updatedMessage.id ? updatedMessage : msg));
    });
  }, [queryClient, userId]);

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
    return data as Message;
  }, [userId, supabase, queryClient]);

  const markAsRead = useCallback(async (messageId: string) => {
    const { error } = await supabase
      .from("messages")
      .update({ is_read: true })
      .eq("id", messageId);
    
    if (!error) {
      queryClient.setQueryData(["messages", userId], (oldData: Message[] | undefined) => {
        if (!oldData) return [];
        return oldData.map(msg => msg.id === messageId ? { ...msg, is_read: true } : msg);
      });
    }
  }, [supabase, queryClient, userId]);

  return {
    messages,
    sendMessage,
    markAsRead,
    isLoading
  };
}
