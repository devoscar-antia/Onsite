import { backendFetch } from "@/lib/api-server";
import { validateCsrf } from "@/lib/csrf";
import { NextResponse } from "next/server";
import { z } from "zod";

const ProcessSchema = z.object({
  video_filename: z.string().min(1),
});

export async function POST(request: Request) {
  if (!await validateCsrf(request)) {
    return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = ProcessSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { errors: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const res = await backendFetch("/api/v1/videos/process", {
    method: "POST",
    body: JSON.stringify({ ...parsed.data, model_key: "conveyor-products" }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    return NextResponse.json(err, { status: res.status });
  }

  return NextResponse.json(await res.json());
}
