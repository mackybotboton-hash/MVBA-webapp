import type { Metadata, Viewport } from "next";
import { Inter, Geist } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { PushInitializer } from "@/components/shared/PushInitializer";
import { QueryProvider } from "@/providers/query-provider";
import { NotificationCountsProvider } from "@/hooks/use-notification-counts";
import { Toaster } from "@/components/ui/sonner";
import { AuthListener } from "@/components/shared/auth-listener";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://mvba-webapp.vercel.app"),
  title: "Panaw — book direct sa Britania, San Agustin",
  description: "Panaw — book direct sa Britania, San Agustin",
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
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Panaw",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/icons/icon-192.png" },
    ],
    shortcut: "/icons/icon-192.png",
  },
  openGraph: {
    title: "Panaw — book direct sa Britania, San Agustin",
    description: "Panaw — book direct sa Britania, San Agustin",
    siteName: "Panaw",
    images: [
      {
        url: "/icons/icon-512.png",
        width: 512,
        height: 512,
        alt: "Panaw Bretania",
      },
    ],
    type: "website",
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
      <head>
        <link rel="manifest" href="/manifest.json" crossOrigin="use-credentials" />
      </head>
      <body className={`${inter.variable} font-sans antialiased bg-background text-foreground tracking-tight min-h-screen selection:bg-neutral-200 selection:text-black`}>
        <QueryProvider>
          <NotificationCountsProvider>
            {children}
            <PushInitializer />
            <AuthListener />
          </NotificationCountsProvider>
        </QueryProvider>
        <Toaster position="bottom-right" richColors />
      </body>
    </html>
  );
}
