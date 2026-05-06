import { proxyStream } from "@/lib/proxy-utils";

type Ctx = { params: Promise<{ videoId: string }> };

export async function GET(request: Request, ctx: Ctx) {
  const { videoId } = await ctx.params;
  return proxyStream(request, `/videos/${videoId}/processed/stream`);
}
