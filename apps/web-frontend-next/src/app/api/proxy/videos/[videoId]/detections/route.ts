import { proxyJson } from "@/lib/proxy-utils";

type Ctx = { params: Promise<{ videoId: string }> };

export async function GET(_: Request, ctx: Ctx) {
  const { videoId } = await ctx.params;
  return proxyJson(`/videos/${videoId}/detections`);
}
