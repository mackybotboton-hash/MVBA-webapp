"use client";

import * as React from "react";
import { ConnectedChatSystem } from "@/components/shared/connected-chat-system";

export default function HomestayChatPage() {
  return (
    <ConnectedChatSystem
      currentRole="homestay"
      portalTitle="Guest Inquiries & Chat"
      portalSubtitle="Coordinate arrivals, answer questions, and arrange Bretania island hopping transfers with your guests"
    />
  );
}
