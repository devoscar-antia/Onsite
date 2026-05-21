import { backendFetch } from "@/lib/api-server";

export async function GET() {
  const res = await backendFetch("/stream/live/status");
  if (!res.ok) return new Response(null, { status: res.status });
  return new Response(res.body, {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}