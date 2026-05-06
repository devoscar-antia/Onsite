import { backendFetch } from "@/lib/api-server";

type Ctx = { params: Promise<{ videoId: string }> };

export async function GET(_: Request, ctx: Ctx) {
  const { videoId } = await ctx.params;
  const res = await backendFetch(`/videos/${videoId}/thumbnail`);
  if (!res.ok) return new Response(null, { status: res.status });
  return new Response(res.body, {
    status: 200,
    headers: {
      "Content-Type": res.headers.get("Content-Type") ?? "image/jpeg",
      "Cache-Control": "public, max-age=86400",
    },
  });
}
