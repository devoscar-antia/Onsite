import { proxyJson } from "@/lib/proxy-utils";

export async function GET() {
  return proxyJson("/videos");
}
