"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import type { NotificationType } from "@/lib/types/database";

// ============================================================================
// sendNotification — fire-and-forget push + persistent inbox row
// ============================================================================
// CRITICAL DESIGN PRINCIPLE:
//   Every external call in this function is wrapped in its own try/catch.
//   A push notification failure MUST NEVER bubble up and roll back the
//   underlying booking, message, or payment transaction that triggered it.
//   Errors are logged for debugging but silently swallowed.
// ============================================================================

interface NotificationPayload {
  targetUserId: string;
  type: NotificationType;
  title: string;
  body: string;
  url?: string;
}

/**
 * Sends a push notification via OneSignal AND inserts a persistent row
 * into the `notifications` table. Both operations are fire-and-forget:
 * any failure is caught and logged, never re-thrown.
 */
export async function sendNotification(payload: NotificationPayload): Promise<void> {
  const { targetUserId, type, title, body, url } = payload;

  if (!targetUserId) return;

  const supabaseAdmin = createAdminClient();

  // ── 1. Persist notification row (in-app inbox) ──────────────────────────
  try {
    await supabaseAdmin.from("notifications").insert({
      user_id: targetUserId,
      type,
      title,
      body,
      url: url || null,
      is_read: false,
    } as any);
  } catch (dbErr) {
    console.error("[Notify] Failed to insert notification row:", dbErr);
    // Swallowed intentionally — do not block the parent transaction
  }

  // ── 2. Send OneSignal push via External ID (alias method) ───────────────
  // PushInitializer calls OneSignal.login(supabaseUserId) on every sign-in,
  // which registers the Supabase UUID as the OneSignal External ID. We target
  // that alias directly — no DB column lookup required, no per-device gap.
  //
  // Previous approach used include_subscription_ids with profiles.onesignal_id,
  // which silently failed whenever the push-subscription change event didn't
  // fire (e.g., user accepted push on a previous browser session). The External
  // ID is set at the OneSignal account level and survives browser clears.
  const appId = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID;
  const restApiKey = process.env.ONESIGNAL_REST_API_KEY;

  if (!appId || !restApiKey) {
    console.warn("[Notify] OneSignal credentials not configured. Skipping push.");
    return;
  }

  try {
    const response = await fetch("https://onesignal.com/api/v1/notifications", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${restApiKey}`,
      },
      body: JSON.stringify({
        app_id: appId,
        // target_channel is required when using include_aliases (OneSignal v1 API)
        target_channel: "push",
        include_aliases: { external_id: [targetUserId] },
        headings: { en: title },
        contents: { en: body },
        url: url || "/",
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("[Notify] OneSignal API error:", response.status, errText);
    }
  } catch (pushErr) {
    console.error("[Notify] OneSignal fetch failed:", pushErr);
    // Swallowed — network error should never roll back a booking
  }
}

// ============================================================================
// Convenience wrappers for each business event
// These look up the correct recipient(s) from the database, then fire
// sendNotification. All wrappers are also fire-and-forget.
// ============================================================================

/**
 * Fired when a tourist creates a booking.
 * Notifies the HOST (owner) AND the ADMIN.
 */
export async function notifyNewBooking(params: {
  bookingId: string;
  ownerId: string;
  touristName: string;
  propertyName: string;
  checkIn: string;
}) {
  const { bookingId, ownerId, touristName, propertyName, checkIn } = params;

  const supabaseAdmin = createAdminClient();

  // Notify host
  await sendNotification({
    targetUserId: ownerId,
    type: "new_booking",
    title: "New Booking Request",
    body: `${touristName} requested a stay at ${propertyName} starting ${checkIn}.`,
    url: `/bookings`,
  });

  // Notify all admins
  try {
    const { data: admins } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("role", "admin");

    for (const admin of (admins as any[]) || []) {
      await sendNotification({
        targetUserId: admin.id,
        type: "new_booking",
        title: "New Booking — Deposit Pending",
        body: `${touristName} booked ${propertyName}. Awaiting GCash deposit.`,
        url: `/admin/transactions`,
      });
    }
  } catch (adminLookupErr) {
    console.error("[Notify] Failed to lookup admins for new booking:", adminLookupErr);
  }
}

/**
 * Fired when a host accepts or declines a booking.
 * Notifies the TOURIST.
 */
export async function notifyBookingStatusChange(params: {
  touristId: string;
  newStatus: "accepted" | "declined" | "cancelled";
  propertyName: string;
  checkIn: string;
}) {
  const { touristId, newStatus, propertyName, checkIn } = params;

  if (newStatus === "cancelled") {
    await sendNotification({
      targetUserId: touristId,
      type: "booking_status",
      title: "Booking Cancelled",
      body: `Your booking at ${propertyName} for ${checkIn} was cancelled.`,
      url: `/bookings`,
    });
    return;
  }

  const isAccepted = newStatus === "accepted";

  await sendNotification({
    targetUserId: touristId,
    type: "booking_status",
    title: isAccepted ? "Booking Confirmed!" : "Booking Declined",
    body: isAccepted
      ? `Your stay at ${propertyName} on ${checkIn} has been confirmed! Please upload your GCash deposit to finalize.`
      : `Your booking request for ${propertyName} on ${checkIn} was declined. Browse other properties.`,
    url: `/bookings`,
  });
}

/**
 * Fired when admin verifies the deposit.
 * Notifies the HOST and the TOURIST.
 */
export async function notifyDepositVerified(params: {
  touristId: string;
  ownerId: string;
  propertyName: string;
}) {
  const { touristId, ownerId, propertyName } = params;

  // Notify tourist
  await sendNotification({
    targetUserId: touristId,
    type: "deposit_verified",
    title: "Deposit Verified!",
    body: `Your GCash deposit for ${propertyName} has been verified by the admin. You're all set!`,
    url: `/bookings`,
  });

  // Notify host
  await sendNotification({
    targetUserId: ownerId,
    type: "deposit_verified",
    title: "Deposit Confirmed",
    body: `The deposit for your ${propertyName} booking has been verified. Payout is being processed.`,
    url: `/bookings`,
  });
}

/**
 * Fired when a tourist or host sends a message.
 * Notifies the RECIPIENT.
 */
export async function notifyNewMessage(params: {
  recipientId: string;
  senderName: string;
  senderId: string;
  messagePreview: string;
}) {
  const { recipientId, senderName, senderId, messagePreview } = params;

  await sendNotification({
    targetUserId: recipientId,
    type: "new_message",
    title: senderName,
    body: messagePreview.length > 80 ? `${messagePreview.slice(0, 77)}...` : messagePreview,
    url: `?guest=${senderId}`,
  });
}

/**
 * Fired when a tourist cancels a booking.
 * Notifies the HOST.
 */
export async function notifyBookingCancelled(params: {
  ownerId: string;
  touristName: string;
  propertyName: string;
  checkIn: string;
}) {
  const { ownerId, touristName, propertyName, checkIn } = params;

  await sendNotification({
    targetUserId: ownerId,
    type: "booking_cancelled",
    title: "Booking Cancelled",
    body: `${touristName} cancelled their booking at ${propertyName} for ${checkIn}.`,
    url: `/bookings`,
  });
}

// ============================================================================
// Secure Authenticated Server Actions for Notifications & Seen State
// ============================================================================
// All actions below authenticate the user from the server session (cookies)
// and operate ONLY on rows belonging to that user. Client-supplied userId is rejected.
// ============================================================================

import { createClient as createServerSupabase } from "@/lib/supabase/server";

/**
 * Marks all unseen bookings as seen for the authenticated host.
 */
export async function markBookingsAsSeenAction(): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createServerSupabase();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();

    if (authErr || !user) {
      return { success: false, error: "Unauthorized" };
    }

    const admin = createAdminClient();
    const { error: updateErr } = await (admin.from("bookings") as any)
      .update({ seen_by_host_at: new Date().toISOString() })
      .eq("owner_id", user.id)
      .is("seen_by_host_at", null);

    if (updateErr) {
      console.error("[NotifyActions] Failed to mark bookings as seen:", updateErr);
      return { success: false, error: updateErr.message };
    }

    return { success: true };
  } catch (err: any) {
    console.error("[NotifyActions] markBookingsAsSeenAction error:", err);
    return { success: false, error: err.message };
  }
}

/**
 * Marks a specific booking as seen for the authenticated host.
 */
export async function markSingleBookingAsSeenAction(bookingId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createServerSupabase();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();

    if (authErr || !user) {
      return { success: false, error: "Unauthorized" };
    }

    const admin = createAdminClient();
    const { error: updateErr } = await (admin.from("bookings") as any)
      .update({ seen_by_host_at: new Date().toISOString() })
      .eq("id", bookingId)
      .eq("owner_id", user.id)
      .is("seen_by_host_at", null);

    if (updateErr) {
      console.error("[NotifyActions] Failed to mark single booking as seen:", updateErr);
      return { success: false, error: updateErr.message };
    }

    return { success: true };
  } catch (err: any) {
    console.error("[NotifyActions] markSingleBookingAsSeenAction error:", err);
    return { success: false, error: err.message };
  }
}

/**
 * Deletes all notifications for the authenticated user.
 * If includeBookingsSeen is true (for hosts), also marks unseen bookings as seen.
 */
export async function deleteAllNotificationsAction(options?: { includeBookingsSeen?: boolean }): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createServerSupabase();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();

    if (authErr || !user) {
      return { success: false, error: "Unauthorized" };
    }

    const admin = createAdminClient();

    // 1. Delete notifications belonging to authenticated user
    const { error: deleteErr } = await (admin.from("notifications") as any)
      .delete()
      .eq("user_id", user.id);

    if (deleteErr) {
      console.error("[NotifyActions] Failed to delete notifications:", deleteErr);
      return { success: false, error: deleteErr.message };
    }

    // 2. If host opted to clear unseen bookings as well, mark them seen
    if (options?.includeBookingsSeen) {
      const { error: seenErr } = await (admin.from("bookings") as any)
        .update({ seen_by_host_at: new Date().toISOString() })
        .eq("owner_id", user.id)
        .is("seen_by_host_at", null);

      if (seenErr) {
        console.error("[NotifyActions] Failed to mark bookings as seen during deleteAll:", seenErr);
      }
    }

    return { success: true };
  } catch (err: any) {
    console.error("[NotifyActions] deleteAllNotificationsAction error:", err);
    return { success: false, error: err.message };
  }
}

/**
 * Marks a single notification as read for the authenticated user.
 */
export async function markNotificationReadAction(notificationId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createServerSupabase();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();

    if (authErr || !user) {
      return { success: false, error: "Unauthorized" };
    }

    const admin = createAdminClient();
    const { error: updateErr } = await (admin.from("notifications") as any)
      .update({ is_read: true })
      .eq("id", notificationId)
      .eq("user_id", user.id);

    if (updateErr) {
      console.error("[NotifyActions] Failed to mark notification read:", updateErr);
      return { success: false, error: updateErr.message };
    }

    return { success: true };
  } catch (err: any) {
    console.error("[NotifyActions] markNotificationReadAction error:", err);
    return { success: false, error: err.message };
  }
}

/**
 * Marks all notifications as read for the authenticated user.
 */
export async function markAllNotificationsReadAction(): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createServerSupabase();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();

    if (authErr || !user) {
      return { success: false, error: "Unauthorized" };
    }

    const admin = createAdminClient();
    const { error: updateErr } = await (admin.from("notifications") as any)
      .update({ is_read: true })
      .eq("user_id", user.id)
      .eq("is_read", false);

    if (updateErr) {
      console.error("[NotifyActions] Failed to mark all notifications read:", updateErr);
      return { success: false, error: updateErr.message };
    }

    return { success: true };
  } catch (err: any) {
    console.error("[NotifyActions] markAllNotificationsReadAction error:", err);
    return { success: false, error: err.message };
  }
}

