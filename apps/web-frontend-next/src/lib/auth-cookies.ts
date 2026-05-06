import "server-only";

import { jwtVerify } from "jose";
import { cookies } from "next/headers";

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET ?? "");

export interface SessionPayload {
  sub: string;
  type: "access" | "refresh";
  exp: number;
}

export interface AuthUser {
  id: string;
  role: string;
}

export async function getServerSession(): Promise<AuthUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("access_token")?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET, {
      algorithms: ["HS256"],
    });
    const p = payload as unknown as SessionPayload;
    if (p.type !== "access") return null;
    return { id: p.sub, role: String(payload.role ?? "viewer") };
  } catch {
    return null;
  }
}

export async function getAccessToken(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get("access_token")?.value ?? null;
}

const IS_PROD = process.env.NODE_ENV === "production";
const COOKIE_BASE = {
  httpOnly: true,
  secure: IS_PROD,
  sameSite: "strict" as const,
  path: "/",
};

export async function setAuthCookies(tokens: {
  access_token: string;
  refresh_token: string;
}) {
  const cookieStore = await cookies();
  cookieStore.set("access_token", tokens.access_token, {
    ...COOKIE_BASE,
    maxAge: 15 * 60,
  });
  cookieStore.set("refresh_token", tokens.refresh_token, {
    ...COOKIE_BASE,
    maxAge: 7 * 24 * 60 * 60,
  });
}

export async function clearAuthCookies() {
  const cookieStore = await cookies();
  cookieStore.delete("access_token");
  cookieStore.delete("refresh_token");
}
