import { Suspense } from "react";
import { RegisterClientPage } from "./client-page";

export const metadata = {
  title: "Create Account - Bretania",
  description: "Join the Bretania community.",
};

export default function RegisterPage() {
  return (
    <div className="min-h-screen bg-neutral-100/50 flex items-center justify-center">
      <Suspense fallback={null}>
        <RegisterClientPage />
      </Suspense>
    </div>
  );
}
