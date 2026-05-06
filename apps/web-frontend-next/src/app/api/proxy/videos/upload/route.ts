import { backendFetch } from "@/lib/api-server";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const contentType = request.headers.get("Content-Type") ?? "";
  if (!contentType.startsWith("multipart/form-data")) {
    return NextResponse.json(
      { error: "Expected multipart/form-data" },
      { status: 400 },
    );
  }

  // Pipe request body directly — never buffer video files in memory
  const res = await backendFetch("/videos/upload", {
    method: "POST",
    headers: { "Content-Type": contentType },
    body: request.body,
    // @ts-expect-error — duplex is not in the standard RequestInit typings yet
    duplex: "half",
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    return NextResponse.json(err, { status: res.status });
  }

  return NextResponse.json(await res.json());
}
