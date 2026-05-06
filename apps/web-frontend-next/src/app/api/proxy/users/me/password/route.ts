import { backendFetch } from "@/lib/api-server";
import { validateCsrf } from "@/lib/csrf";
import { NextResponse } from "next/server";

export async function PUT(request: Request) {
  if (!await validateCsrf(request)) {
    return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const res = await backendFetch("/users/me/password", {
    method: "PUT",
    body: JSON.stringify(body),
  });
  if (!res.ok) return NextResponse.json(await res.json().catch(() => ({})), { status: res.status });
  return NextResponse.json(await res.json());
}
