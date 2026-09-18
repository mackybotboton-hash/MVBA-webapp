import type { Metadata, Viewport } from "next";
import { Inter, Geist } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { PushInitializer } from "@/components/shared/PushInitializer";
import { QueryProvider } from "@/providers/query-provider";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Britania Travel — Resort & Homestay Bookings",
  description:
    "Discover and book stays in Britania, San Agustin, Surigao del Sur. Browse resorts, homestays, island hopping tours, and more.",
  keywords: [
    "Britania",
    "San Agustin",
    "Surigao del Sur",
    "resort",
    "homestay",
    "booking",
    "Philippines",
    "island hopping",
  ],
  authors: [{ name: "Britania Tourism" }],
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Britania",
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
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={cn("font-sans", geist.variable)} data-scroll-behavior="smooth">
      <body className={`${inter.variable} font-sans antialiased bg-background text-foreground tracking-tight min-h-screen selection:bg-neutral-200 selection:text-black`}>
        <QueryProvider>
          {children}
          <PushInitializer />
        </QueryProvider>
      </body>
    </html>
  );
}
