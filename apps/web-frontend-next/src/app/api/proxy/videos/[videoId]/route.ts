import { proxyJson } from "@/lib/proxy-utils";
import { validateCsrf } from "@/lib/csrf";
import { NextResponse } from "next/server";

type Ctx = { params: Promise<{ videoId: string }> };

export async function DELETE(request: Request, ctx: Ctx) {
  if (!await validateCsrf(request)) {
    return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 });
  }

  const { videoId } = await ctx.params;
  return proxyJson(`/videos/${videoId}`, { method: "DELETE" });
}

export async function GET(_: Request, ctx: Ctx) {
  const { videoId } = await ctx.params;
  return proxyJson(`/videos/${videoId}`);
}
