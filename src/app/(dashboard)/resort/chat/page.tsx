"use client";

import * as React from "react";
import { ConnectedChatSystem } from "@/components/shared/connected-chat-system";

export default function ResortChatPage() {
  return (
    <ConnectedChatSystem
      currentRole="resort"
      portalTitle="Guest Inquiries & Reservations Chat"
      portalSubtitle="Coordinate villa check-ins, island boat transfers, and special catering requests directly with tourists"
    />
  );
}
