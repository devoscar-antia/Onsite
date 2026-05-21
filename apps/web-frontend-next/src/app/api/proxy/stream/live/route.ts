import { BACKEND_URL } from "@/lib/api-server";
import { getAccessToken } from "@/lib/auth-cookies";
import { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  const conf = req.nextUrl.searchParams.get("conf") ?? "0.35";
  const token = await getAccessToken();

  // No timeout — stream is infinite; AbortSignal.timeout(15_000) in backendFetch would kill it
  const res = await fetch(`${BACKEND_URL}/stream/live?conf=${conf}`, {
    headers: {
      Accept: "multipart/x-mixed-replace",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  if (!res.ok) return new Response(null, { status: res.status });

  return new Response(res.body, {
    status: 200,
    headers: {
      "Content-Type": res.headers.get("Content-Type") ?? "multipart/x-mixed-replace; boundary=frame",
      "Cache-Control": "no-cache, no-store",
      "X-Accel-Buffering": "no",
      "Transfer-Encoding": "chunked",
    },
  });
}