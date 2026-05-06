import { clearAuthCookies } from "@/lib/auth-cookies";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function POST() {
  const cookieStore = await cookies();
  const refreshToken = cookieStore.get("refresh_token")?.value;

  if (refreshToken) {
    try {
      await fetch(`${process.env.BACKEND_URL}/api/v1/auth/logout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });
    } catch {
      // best-effort — always clear cookies regardless
    }
  }

  await clearAuthCookies();
  return new NextResponse(null, { status: 204 });
}
