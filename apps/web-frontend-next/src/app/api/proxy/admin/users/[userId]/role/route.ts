import { backendFetch } from "@/lib/api-server";
import { validateCsrf } from "@/lib/csrf";
import { NextResponse } from "next/server";
import { z } from "zod";

const RoleSchema = z.object({
  role: z.enum(["admin", "viewer"]),
});

type Ctx = { params: Promise<{ userId: string }> };

export async function PATCH(request: Request, ctx: Ctx) {
  if (!await validateCsrf(request)) {
    return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 });
  }

  const { userId } = await ctx.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = RoleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { errors: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const res = await backendFetch(`/admin/users/${userId}/role`, {
    method: "PATCH",
    body: JSON.stringify(parsed.data),
  });

  if (!res.ok) return NextResponse.json(await res.json().catch(() => ({})), { status: res.status });
  return NextResponse.json(await res.json());
}
