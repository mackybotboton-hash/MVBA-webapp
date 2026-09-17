"use client";

import * as React from "react";
import { PlaySquare } from "lucide-react";

interface SocialVideoEmbedProps {
  url: string;
  className?: string;
}

export function SocialVideoEmbed({ url, className = "" }: SocialVideoEmbedProps) {
  const [embedUrl, setEmbedUrl] = React.useState<string | null>(null);
  const [platform, setPlatform] = React.useState<"youtube" | "tiktok" | null>(null);

  React.useEffect(() => {
    if (!url) return;

    try {
      const urlObj = new URL(url);

      // YouTube Shorts or normal YouTube
      if (urlObj.hostname.includes("youtube.com") || urlObj.hostname.includes("youtu.be")) {
        setPlatform("youtube");
        let videoId = "";
        if (urlObj.pathname.includes("/shorts/")) {
          videoId = urlObj.pathname.split("/shorts/")[1].split("?")[0];
        } else if (urlObj.hostname.includes("youtu.be")) {
          videoId = urlObj.pathname.slice(1).split("?")[0];
        } else {
          videoId = urlObj.searchParams.get("v") || "";
        }

        if (videoId) {
          setEmbedUrl(`https://www.youtube.com/embed/${videoId}?autoplay=0&rel=0`);
        }
      }
      // TikTok
      else if (urlObj.hostname.includes("tiktok.com")) {
        setPlatform("tiktok");
        // TikTok URLs often look like https://www.tiktok.com/@username/video/720193290123
        const match = urlObj.pathname.match(/\/video\/(\d+)/);
        if (match && match[1]) {
          const videoId = match[1];
          setEmbedUrl(`https://www.tiktok.com/embed/v2/${videoId}`);
        }
      }
    } catch (e) {
      console.error("Invalid URL format for video embed", e);
    }
  }, [url]);

  if (!embedUrl) {
    return (
      <div className={`flex flex-col items-center justify-center p-6 bg-neutral-100 rounded-xl border border-neutral-200 text-neutral-500 ${className}`}>
        <PlaySquare className="h-8 w-8 mb-2 opacity-50" />
        <p className="text-xs text-center font-medium">Video not available or link format is incorrect.</p>
      </div>
    );
  }

  return (
    <div className={`relative w-full rounded-xl overflow-hidden bg-black ${className}`} style={{ aspectRatio: platform === "youtube" && url.includes("/shorts/") ? "9/16" : platform === "tiktok" ? "9/16" : "16/9" }}>
      <iframe
        src={embedUrl}
        className="absolute top-0 left-0 w-full h-full border-0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
        title="Embedded Social Video"
      />
    </div>
  );
}
