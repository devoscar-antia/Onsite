import { setAuthCookies } from "@/lib/auth-cookies";
import { BACKEND_URL } from "@/lib/api-server";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function POST() {
  const cookieStore = await cookies();
  const refreshToken = cookieStore.get("refresh_token")?.value;

  if (!refreshToken) {
    return NextResponse.json({ error: "No refresh token" }, { status: 401 });
  }

  const upstream = await fetch(`${BACKEND_URL}/api/v1/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });

  if (!upstream.ok) {
    return NextResponse.json(
      { error: "Token refresh failed" },
      { status: 401 },
    );
  }

  const tokens = (await upstream.json()) as {
    access_token: string;
    refresh_token: string;
  };

  await setAuthCookies(tokens);
  return new NextResponse(null, { status: 204 });
}
