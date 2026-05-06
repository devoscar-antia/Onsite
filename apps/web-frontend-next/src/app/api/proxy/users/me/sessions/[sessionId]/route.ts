import { proxyJson } from "@/lib/proxy-utils";
import { validateCsrf } from "@/lib/csrf";
import { NextResponse } from "next/server";

type Ctx = { params: Promise<{ sessionId: string }> };

export async function DELETE(request: Request, ctx: Ctx) {
  if (!await validateCsrf(request)) {
    return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 });
  }

  const { sessionId } = await ctx.params;
  return proxyJson(`/users/me/sessions/${sessionId}`, { method: "DELETE" });
}
