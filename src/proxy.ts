import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";
import { ROLE_HOME_ROUTES, type UserRole } from "@/lib/constants";

// ----------------------------------------------------------------------------
// STATIC PRE-ALLOCATED LOOKUP TABLES (Zero-GC allocations per request)
// ----------------------------------------------------------------------------
const PUBLIC_AUTH_ROUTES = new Set(["/login", "/register"]);
const TOURIST_PUBLIC_EXACT = new Set([
  "/",
  "/explore",
  "/wishlist",
  "/terms",
  "/privacy",
  "/cookies",
  "/policies",
]);
const TOURIST_ONLY_PREFIXES = ["/bookings", "/chat"] as const;

// Static map for O(1) prefix validation without runtime array allocations
const OPERATOR_PREFIX_TO_ROLE: Readonly<Record<string, UserRole>> = {
  "/admin": "admin",
  "/homestay": "homestay",
  "/resort": "resort",
};

const OPERATOR_PREFIXES = Object.keys(OPERATOR_PREFIX_TO_ROLE) as (keyof typeof OPERATOR_PREFIX_TO_ROLE)[];

/**
 * High-performance safe redirect that preserves all refreshed Supabase cookies.
 */
function createSafeRedirect(
  destinationUrl: URL | string,
  request: NextRequest,
  sourceResponse: NextResponse
): NextResponse {
  const redirectResponse = NextResponse.redirect(
    destinationUrl instanceof URL ? destinationUrl : new URL(destinationUrl, request.url)
  );

  // Preserve all refreshed session tokens on redirect
  const cookies = sourceResponse.cookies.getAll();
  for (let i = 0; i < cookies.length; i++) {
    const c = cookies[i];
    redirectResponse.cookies.set(c.name, c.value, {
      path: c.path,
      domain: c.domain,
      maxAge: c.maxAge,
      httpOnly: c.httpOnly,
      secure: true, // ENFORCED for Zero-Trust Architecture
      sameSite: "lax",
    });
  }

  return redirectResponse;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // --------------------------------------------------------------------------
  // 1. PUBLIC ROUTE CLASSIFICATIONS
  // --------------------------------------------------------------------------
  const isAuthRoute = PUBLIC_AUTH_ROUTES.has(pathname);
  const isTouristPublic =
    TOURIST_PUBLIC_EXACT.has(pathname) || pathname.startsWith("/property/");

  // --------------------------------------------------------------------------
  // 2. SESSION VALIDATION VIA EDGE COOKIES
  // --------------------------------------------------------------------------
  const { user, supabaseResponse, supabase } = await updateSession(request);

  // --------------------------------------------------------------------------
  // 3. UNAUTHENTICATED USERS (Edge Redirect to Prevent Hydration on Private Routes)
  // --------------------------------------------------------------------------
  if (!user) {
    if (isAuthRoute || isTouristPublic) {
      return supabaseResponse;
    }

    // Strict edge-level redirect for unauthenticated users accessing protected routes
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return createSafeRedirect(loginUrl, request, supabaseResponse);
  }

  // --------------------------------------------------------------------------
  // 4. AUTHENTICATED USERS: ZERO-TRUST ROLE RESOLUTION
  // Disallow trusting client-writable user_metadata.
  // Priority: 1. DB profiles table -> 2. Server-managed app_metadata -> 3. Fallback ('tourist')
  // --------------------------------------------------------------------------
  let userRole: UserRole = "tourist";

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, is_approved")
    .eq("id", user.id)
    .maybeSingle<{ role: string; is_approved: boolean }>();

  if (profile?.role) {
    // Unapproved operator accounts cannot access operator dashboards
    if (["admin", "homestay", "resort"].includes(profile.role) && !profile.is_approved) {
      userRole = "tourist";
    } else {
      userRole = profile.role as UserRole;
    }
  } else if (user.app_metadata?.role) {
    userRole = user.app_metadata.role as UserRole;
  }

  // Cache resolved verified role in secure httpOnly cookie
  supabaseResponse.cookies.set("mvba_user_role", userRole, {
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
    httpOnly: true, // Mitigate client-side XSS / script forgery
    secure: true,
    sameSite: "lax",
  });

  const userDashboard = ROLE_HOME_ROUTES[userRole] || "/";

  // If authenticated user visits /login or /register, redirect to their home
  if (isAuthRoute) {
    return createSafeRedirect(userDashboard, request, supabaseResponse);
  }

  // --------------------------------------------------------------------------
  // 5. BOUNDARY ISOLATION FOR ROLES
  // --------------------------------------------------------------------------
  const isPrefetch =
    request.headers.get("x-next-router-prefetch") === "1" ||
    request.headers.get("purpose") === "prefetch" ||
    request.headers.get("sec-purpose") === "prefetch";

  // Operators (Admin/Homestay/Resort) landing on tourist root should go to their dashboards
  if (pathname === "/" && userRole !== "tourist") {
    if (isPrefetch) return supabaseResponse; // Skip prefetch poisoning
    return createSafeRedirect(userDashboard, request, supabaseResponse);
  }

  // Block operators from tourist-only routes (/bookings, /chat)
  if (userRole !== "tourist") {
    for (let i = 0; i < TOURIST_ONLY_PREFIXES.length; i++) {
      if (pathname.startsWith(TOURIST_ONLY_PREFIXES[i])) {
        return createSafeRedirect(userDashboard, request, supabaseResponse);
      }
    }
  }

  // STRICT PATH BOUNDARY ENFORCEMENT
  for (let i = 0; i < OPERATOR_PREFIXES.length; i++) {
    const prefix = OPERATOR_PREFIXES[i];
    if (pathname.startsWith(prefix)) {
      const requiredRole = OPERATOR_PREFIX_TO_ROLE[prefix];
      if (userRole !== requiredRole) {
        // Zero-Trust: Role escalation attempt caught at Edge.
        return createSafeRedirect(userDashboard, request, supabaseResponse);
      }
      break;
    }
  }

  // Pass-through with refreshed cookies
  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|json|js|css|woff|woff2|ttf|map|webmanifest)$).*)",
  ],
};
