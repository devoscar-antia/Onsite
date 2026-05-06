import { proxyJson } from "@/lib/proxy-utils";

export async function GET() {
  return proxyJson("/admin/users/stats");
}
