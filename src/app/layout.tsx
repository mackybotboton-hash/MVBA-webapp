import type { Metadata, Viewport } from "next";
import { Inter, Geist } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "MVBA — San Agustin Resort & Homestay Association",
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
    "MVBA",
  ],
  authors: [{ name: "MVBA Association" }],
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "MVBA",
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
        {children}
      </body>
    </html>
  );
}
