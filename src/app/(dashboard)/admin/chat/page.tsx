"use client";

import * as React from "react";
import { ConnectedChatSystem } from "@/components/shared/connected-chat-system";

export default function AdminChatPage() {
  return (
    <ConnectedChatSystem
      currentRole="admin"
      portalTitle="Association Messages & Host Inquiries"
      portalSubtitle="Direct communication channel with Bretania homestay and resort owners regarding association affairs, permits, and advisories"
    />
  );
}
