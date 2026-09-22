"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FileText, Shield, Cookie, Anchor } from "lucide-react";

const POLICY_TABS = [
  { href: "/terms", label: "Terms of Service", icon: FileText },
  { href: "/privacy", label: "Privacy Policy", icon: Shield },
  { href: "/cookies", label: "Cookie Policy", icon: Cookie },
  { href: "/policies", label: "Eco-Tourism & Safety", icon: Anchor },
];

export function PolicyNav() {
  const pathname = usePathname();

  return (
    <div className="flex items-center gap-1.5 overflow-x-auto pb-3 pt-1 scrollbar-hide border-b border-neutral-200">
      {POLICY_TABS.map((tab) => {
        const isActive = pathname === tab.href;
        const Icon = tab.icon;

        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-medium transition-all shrink-0 select-none ${
              isActive
                ? "bg-neutral-900 text-white shadow-xs"
                : "border border-neutral-200 bg-white text-neutral-600 hover:text-neutral-950 hover:border-neutral-300"
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            <span>{tab.label}</span>
          </Link>
        );
      })}
    </div>
  );
}
