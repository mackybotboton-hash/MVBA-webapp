"use client";

import { LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export function SignOutButton() {
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
  }

  return (
    <button
      onClick={handleSignOut}
      className="w-full flex items-center gap-4 p-4 rounded-xl border border-neutral-200 bg-white hover:bg-red-50 hover:border-red-200 transition-all text-left group"
    >
      <div className="w-10 h-10 rounded-lg bg-neutral-100 group-hover:bg-red-100 flex items-center justify-center transition-colors">
        <LogOut className="h-4 w-4 text-neutral-600 group-hover:text-red-600 transition-colors" />
      </div>
      <div>
        <p className="text-sm font-medium text-neutral-900 group-hover:text-red-600 transition-colors">
          Sign Out
        </p>
        <p className="text-xs text-neutral-600">Log out of your MVBA account</p>

      </div>
    </button>
  );
}
