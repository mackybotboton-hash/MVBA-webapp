import type { Metadata, Viewport } from "next";
import { Inter, Geist } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { PushInitializer } from "@/components/shared/PushInitializer";
import { QueryProvider } from "@/providers/query-provider";
import { NotificationCountsProvider } from "@/hooks/use-notification-counts";
import { Toaster } from "@/components/ui/sonner";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Bretania Travel — Resort & Homestay Bookings",
  description:
    "Discover and book stays in Bretania, San Agustin, Surigao del Sur. Browse resorts, homestays, island hopping tours, and more.",
  keywords: [
    "Bretania",
    "San Agustin",
    "Surigao del Sur",
    "resort",
    "homestay",
    "booking",
    "Philippines",
    "island hopping",
  ],
  authors: [{ name: "Bretania Tourism" }],
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Bretania",
  },
  icons: {
    apple: [
      { url: '/icons/icon-192.png' },
    ],
  },
};


export const viewport: Viewport = {
  themeColor: "#ffffff",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={cn("font-sans", geist.variable)} data-scroll-behavior="smooth">
      <body className={`${inter.variable} font-sans antialiased bg-background text-foreground text-base leading-relaxed tracking-tight min-h-screen selection:bg-neutral-200 selection:text-black`}>
        <QueryProvider>
          <NotificationCountsProvider>
            {children}
            <PushInitializer />
          </NotificationCountsProvider>
        </QueryProvider>
        <Toaster position="bottom-right" richColors />
      </body>
    </html>
  );
}
