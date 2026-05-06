import { jwtVerify } from "jose";
import { NextRequest, NextResponse } from "next/server";

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET ?? "");
const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8000";
const IS_PROD = process.env.NODE_ENV === "production";

const COOKIE_BASE = {
  httpOnly: true,
  secure: IS_PROD,
  sameSite: "strict" as const,
  path: "/",
};

function isPublicPath(pathname: string): boolean {
  return (
    pathname.startsWith("/login") ||
    pathname.startsWith("/register") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico"
  );
}

async function isValidToken(token: string): Promise<boolean> {
  try {
    await jwtVerify(token, JWT_SECRET, { algorithms: ["HS256"] });
    return true;
  } catch {
    return false;
  }
}

function addSecurityHeaders(response: NextResponse): NextResponse {
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set(
    "Referrer-Policy",
    "strict-origin-when-cross-origin",
  );
  return response;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isPublicPath(pathname)) {
    return addSecurityHeaders(NextResponse.next());
  }

  const accessToken = request.cookies.get("access_token")?.value;
  const refreshToken = request.cookies.get("refresh_token")?.value;

  // Happy path — valid access token
  if (accessToken && (await isValidToken(accessToken))) {
    return addSecurityHeaders(NextResponse.next());
  }

  // Try silent refresh via FastAPI directly (Edge cannot call Next.js route handlers)
  if (refreshToken) {
    try {
      const res = await fetch(`${BACKEND_URL}/api/v1/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });

      if (res.ok) {
        const tokens = (await res.json()) as {
          access_token: string;
          refresh_token: string;
        };
        const response = addSecurityHeaders(NextResponse.next());
        response.cookies.set("access_token", tokens.access_token, {
          ...COOKIE_BASE,
          maxAge: 15 * 60,
        });
        response.cookies.set("refresh_token", tokens.refresh_token, {
          ...COOKIE_BASE,
          maxAge: 7 * 24 * 60 * 60,
        });
        return response;
      }
    } catch {
      // network error — fall through to redirect
    }
  }

  // No valid session — redirect to login
  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", pathname);
  const redirect = NextResponse.redirect(loginUrl);
  redirect.cookies.delete("access_token");
  redirect.cookies.delete("refresh_token");
  return redirect;
}

export const config = {
  // Skip Next.js static assets and image optimisation routes
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
