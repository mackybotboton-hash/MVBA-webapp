import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";
import { ROLE_HOME_ROUTES, type UserRole } from "@/lib/constants";

// ----------------------------------------------------------------------------
// STATIC PRE-ALLOCATED LOOKUP TABLES (Zero-GC allocations per request)
// ----------------------------------------------------------------------------
const PUBLIC_AUTH_ROUTES = new Set<string>([]);
const TOURIST_PUBLIC_EXACT = new Set(["/", "/explore", "/wishlist"]);
// Removed "/profile" so owners and admins can access their account profile
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
      secure: c.secure,
      sameSite: c.sameSite,
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
  // 3. UNAUTHENTICATED USERS
  // --------------------------------------------------------------------------
  if (!user) {
    if (isAuthRoute || isTouristPublic) {
      return supabaseResponse;
    }
    console.log("[PROXY] No user. Redirecting from", pathname, "to /?redirect=", pathname);
    const loginUrl = new URL("/", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return createSafeRedirect(loginUrl, request, supabaseResponse);
  }

  // --------------------------------------------------------------------------
  // 4. AUTHENTICATED USERS: ACCURATE ROLE RESOLUTION
  // Priority: 1. JWT User Metadata -> 2. PostgreSQL profiles query -> 3. Cookie cache -> 4. Fallback
  // --------------------------------------------------------------------------
  const cachedRoleCookie = request.cookies.get("mvba_user_role")?.value as UserRole | undefined;

  let userRole: UserRole =
    (user.user_metadata?.role as UserRole) ||
    (user.app_metadata?.role as UserRole) ||
    cachedRoleCookie ||
    "tourist";

  if (!user.user_metadata?.role && !user.app_metadata?.role) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle<{ role: string }>();

    if (profile?.role) {
      userRole = profile.role as UserRole;
    }
  }

  // Cache resolved role in lightweight cookie to avoid transient role-drops on DB latency
  supabaseResponse.cookies.set("mvba_user_role", userRole, {
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
    sameSite: "lax",
  });

  const userDashboard = ROLE_HOME_ROUTES[userRole] || "/";
  console.log(`[PROXY] Auth Check: User=${user.email} Role=${userRole} Path=${pathname}`);

  // If authenticated user visits /login or /register, redirect to their home
  if (isAuthRoute) {
    return createSafeRedirect(userDashboard, request, supabaseResponse);
  }

  // Non-tourists (admin, homestay, resort) visiting root "/" must land on their dashboard
  const isPrefetch =
    request.headers.get("x-next-router-prefetch") === "1" ||
    request.headers.get("purpose") === "prefetch" ||
    request.headers.get("sec-purpose") === "prefetch";

  if (pathname === "/" && userRole !== "tourist") {
    // Avoid poisoning Next.js router prefetch cache with 307 redirects
    if (isPrefetch) {
      return supabaseResponse;
    }
    console.log(`[PROXY] Redirecting ${userRole} from / to ${userDashboard}`);
    return createSafeRedirect(userDashboard, request, supabaseResponse);
  }

  // Non-tourists visiting tourist-only pages (/bookings, /chat)
  if (userRole !== "tourist") {
    for (let i = 0; i < TOURIST_ONLY_PREFIXES.length; i++) {
      if (pathname.startsWith(TOURIST_ONLY_PREFIXES[i])) {
        return createSafeRedirect(userDashboard, request, supabaseResponse);
      }
    }
  }

  // Operator route access control (/admin, /homestay, /resort)
  for (let i = 0; i < OPERATOR_PREFIXES.length; i++) {
    const prefix = OPERATOR_PREFIXES[i];
    if (pathname.startsWith(prefix)) {
      const requiredRole = OPERATOR_PREFIX_TO_ROLE[prefix];
      if (userRole !== requiredRole) {
        console.log(`[PROXY] Role mismatch! User is ${userRole}, but ${prefix} requires ${requiredRole}. Redirecting to ${userDashboard}`);
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
    /*
     * Match all request paths except for:
     * - _next/static (static chunks)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - static assets (.svg, .png, .jpg, .jpeg, .gif, .webp, .avif, .ico, .json, .js, .css, .woff, .woff2, .ttf, .map)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|json|js|css|woff|woff2|ttf|map|webmanifest)$).*)",
  ],
};
