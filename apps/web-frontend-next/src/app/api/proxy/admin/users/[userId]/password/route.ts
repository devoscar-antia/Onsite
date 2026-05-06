import { proxyJson } from "@/lib/proxy-utils";
import { validateCsrf } from "@/lib/csrf";
import { NextResponse } from "next/server";

type Ctx = { params: Promise<{ userId: string }> };

export async function PATCH(request: Request, ctx: Ctx) {
  if (!await validateCsrf(request)) {
    return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 });
  }
  const { userId } = await ctx.params;
  const body = await request.json();
  return proxyJson(`/admin/users/${userId}/password`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
