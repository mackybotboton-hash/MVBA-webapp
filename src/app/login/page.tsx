import { Suspense } from "react";
import { AuthClientPage } from "./client-page";

export const metadata = {
  title: "Sign In - Bretania",
  description: "Sign in to access your bookings and operator portal.",
};

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-neutral-100/50 flex items-center justify-center">
      <Suspense fallback={null}>
        <AuthClientPage />
      </Suspense>
    </div>
  );
}
