import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { backendFetch } from "@/lib/api-server";
import { getServerSession } from "@/lib/auth-cookies";
import type { VideoItem } from "@/types/video";
import { redirect } from "next/navigation";

async function fetchInitialVideos(): Promise<VideoItem[]> {
  try {
    const res = await backendFetch("/videos");
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

export default async function DashboardPage() {
  const session = await getServerSession();
  if (!session) redirect("/login");

  const initialVideos = await fetchInitialVideos();

  return (
    <DashboardShell
      initialUser={{ id: session.id, email: "", role: session.role as "admin" | "viewer" }}
      initialVideos={initialVideos}
    />
  );
}
