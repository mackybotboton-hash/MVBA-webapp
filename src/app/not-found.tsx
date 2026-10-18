import Link from "next/link";
import { Compass, Home, Search } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center p-4 sm:p-6 text-center select-none">
      <div className="max-w-md w-full bg-white border border-neutral-200 rounded-2xl p-6 sm:p-7 shadow-sm space-y-4">
        <div className="mx-auto w-14 h-14 rounded-2xl bg-neutral-100 border border-neutral-200 flex items-center justify-center text-neutral-600">
          <Compass className="h-7 w-7" />
        </div>

        <div className="space-y-2">
          <p className="text-xs font-bold text-neutral-400 uppercase tracking-widest">
            404 Error
          </p>
          <h2 className="text-xl font-bold text-neutral-900 tracking-tight">
            Destination Not Found
          </h2>
          <p className="text-xs sm:text-sm text-neutral-500 leading-relaxed">
            The stay, booking, or page you are looking for does not exist, has been removed, or the link may be outdated.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <Link href="/explore" className="w-full sm:w-auto">
            <Button className="w-full sm:w-auto h-10 px-5 text-xs font-semibold bg-black text-white hover:bg-neutral-800 rounded-xl">
              <Search className="h-3.5 w-3.5 mr-2" />
              Explore Stays
            </Button>
          </Link>
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
