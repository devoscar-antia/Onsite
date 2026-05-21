import { proxyJson } from "@/lib/proxy-utils";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const limit = searchParams.get("limit") ?? "100";
  return proxyJson(`/videos/product-counts?limit=${limit}`);
}