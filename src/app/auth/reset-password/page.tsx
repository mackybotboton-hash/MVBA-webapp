import { Suspense } from "react";
import { ResetPasswordClient } from "./reset-password-client";
import { Loader2 } from "lucide-react";

export const metadata = {
  title: "Reset Password - Panaw",
  description: "Create a new password for your Panaw account.",
};

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen bg-neutral-100/50 flex items-center justify-center p-4">
      <Suspense
        fallback={
          <div className="flex items-center justify-center p-8">
            <Loader2 className="h-8 w-8 animate-spin text-neutral-400" />
          </div>
        }
      >
        <ResetPasswordClient />
      </Suspense>
    </div>
  );
}
