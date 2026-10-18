"use client";

import * as React from "react";
import Link from "next/link";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    // Log unexpected runtime errors to monitoring console
    console.error("[Runtime Error Boundary caught]:", error);
  }, [error]);

  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center p-4 sm:p-6 text-center select-none">
      <div className="max-w-md w-full bg-white border border-neutral-200 rounded-2xl p-6 sm:p-7 shadow-sm space-y-4">
        <div className="mx-auto w-14 h-14 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600">
          <AlertTriangle className="h-7 w-7" />
        </div>

        <div className="space-y-2">
          <h2 className="text-xl font-bold text-neutral-900 tracking-tight">
            Something went wrong
          </h2>
          <p className="text-xs sm:text-sm text-neutral-500 leading-relaxed">
            An unexpected error occurred while rendering this page. You can try refreshing the connection or return to the main dashboard.
          </p>
        </div>

        {error?.digest && (
          <p className="text-[10px] font-mono text-neutral-400 bg-neutral-50 py-1 px-2 rounded-lg border border-neutral-100">
            Error Reference: {error.digest}
          </p>
        )}

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <Button
            onClick={() => reset()}
            className="w-full sm:w-auto h-10 px-5 text-xs font-semibold bg-black text-white hover:bg-neutral-800 rounded-xl"
          >
            <RefreshCw className="h-3.5 w-3.5 mr-2" />
            Try Again
          </Button>
          <Link href="/" className="w-full sm:w-auto">
            <Button
              variant="outline"
              className="w-full sm:w-auto h-10 px-5 text-xs font-semibold border-neutral-200 text-neutral-700 hover:bg-neutral-50 rounded-xl"
            >
              <Home className="h-3.5 w-3.5 mr-2" />
              Return Home
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
