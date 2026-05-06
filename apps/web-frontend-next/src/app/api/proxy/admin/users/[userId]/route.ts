import { proxyJson } from "@/lib/proxy-utils";
import { validateCsrf } from "@/lib/csrf";
import { NextResponse } from "next/server";

type Ctx = { params: Promise<{ userId: string }> };

export async function DELETE(request: Request, ctx: Ctx) {
  if (!await validateCsrf(request)) {
    return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 });
  }

  const { userId } = await ctx.params;
  return proxyJson(`/admin/users/${userId}`, { method: "DELETE" });
}
