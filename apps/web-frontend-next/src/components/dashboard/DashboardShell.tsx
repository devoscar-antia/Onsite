"use client";

import { DashboardTab } from "@/components/analytics/DashboardTab";
import { DeleteConfirmModal } from "@/components/dashboard/DeleteConfirmModal";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { VideoAnalysisTab } from "@/components/video/VideoAnalysisTab";
import { useAuth } from "@/hooks/useAuth";
import { queryKeys } from "@/lib/query-keys";
import { videoService } from "@/services/videoService";
import { useVideoStore, useNameMapStore } from "@/store/videoStore";
import type { AuthUser } from "@/types/auth";
import type { VideoItem } from "@/types/video";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import React, { useCallback, useEffect, useState } from "react";
import SettingsPage from "@/components/settings/SettingsPage";
import LiveMonitorTab from "@/components/live/LiveMonitorTab";
import { BarChart2, FileVideo, Radio, Settings } from "lucide-react";
import type { ActiveTab } from "@/types/video";

type NotifType = "upload" | "processed" | "error";

type Notification = {
  id: string;
  type: NotifType;
  title: string;
  message: string;
  time: string;
  read: boolean;
};

type DeleteConfirm = { id: string; label: string };
type Toast = { kind: "success" | "error"; text: string };

export function DashboardShell({
  initialVideos,
  initialUser,
}: {
  initialVideos: VideoItem[];
  initialUser: AuthUser;
}) {
  const queryClient = useQueryClient();

  // Hydrate auth store once on mount
  const setUser = useAuth((s) => s.setUser);
  useEffect(() => {
    setUser(initialUser);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Rehydrate persisted nameMap store from localStorage (skipHydration prevents SSR mismatch)
  useEffect(() => {
    void useNameMapStore.persist.rehydrate();
  }, []);

  // Hydrate video store once on mount
  const {
    videos,
    selectedVideoId,
    activeTab,
    setVideos,
    setSelectedVideoId,
    setActiveTab,
  } = useVideoStore();
  const { nameMap } = useNameMapStore();

  useEffect(() => {
    if (initialVideos.length > 0 && videos.length === 0) {
      setVideos(
        initialVideos.map((v) => ({
          ...v,
          filename: nameMap[v.id] ?? v.filename,
        })),
      );
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep video list fresh on the client (fallback if SSR fetch was empty)
  const { data: freshVideos } = useQuery({
    queryKey: queryKeys.videos(),
    queryFn: () => videoService.getVideos(),
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });
  useEffect(() => {
    if (!freshVideos) return;
    setVideos(freshVideos.map((v) => ({ ...v, filename: nameMap[v.id] ?? v.filename })));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [freshVideos]);

  // Sidebar collapse
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Theme
  const [isDark, setIsDark] = useState(true);
  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark);
  }, [isDark]);

  // Notifications
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const pushNotification = useCallback((type: NotifType, filename: string) => {
    const TITLES: Record<NotifType, string> = {
      upload: "Video subido",
      processed: "Análisis completado",
      error: "Error al procesar",
    };
    const MESSAGES: Record<NotifType, (f: string) => string> = {
      upload: (f) => `"${f}" se subió correctamente.`,
      processed: (f) => `"${f}" fue analizado y está listo.`,
      error: (f) => `No fue posible analizar "${f}". Intenta de nuevo.`,
    };
    setNotifications((prev) => [
      {
        id: `${type}-${Date.now()}`,
        type,
        title: TITLES[type],
        message: MESSAGES[type](filename),
        time: new Date().toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" }),
        read: false,
      },
      ...prev,
    ].slice(0, 10));
  }, []);

  // Delete
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<DeleteConfirm | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);

  const showToast = useCallback((kind: "success" | "error", text: string) => {
    setToast({ kind, text });
    window.setTimeout(() => setToast(null), 2400);
  }, []);

  const handleDelete = useCallback(
    async (videoId: string) => {
      const target = videos.find((v) => v.id === videoId);
      setDeleteConfirm({ id: videoId, label: target?.filename ?? videoId });
    },
    [videos],
  );

  const confirmDelete = useCallback(async () => {
    if (!deleteConfirm) return;
    const { id } = deleteConfirm;
    const prev = videos;
    const prevSelected = selectedVideoId;
    const next = videos.filter((v) => v.id !== id);

    setDeletingId(id);
    setVideos(next);
    if (selectedVideoId === id) setSelectedVideoId(next[0]?.id ?? null);

    try {
      if (prevSelected === id) {
        setSelectedVideoId(null);
        await new Promise((r) => window.setTimeout(r, 120));
      }
      await videoService.deleteVideo(id);
      await queryClient.invalidateQueries({ queryKey: ["videos"] });
      showToast("success", "Video eliminado correctamente.");
    } catch {
      setVideos(prev);
      setSelectedVideoId(prevSelected);
      showToast("error", "No fue posible eliminar el video.");
    } finally {
      setDeletingId(null);
      setDeleteConfirm(null);
    }
  }, [deleteConfirm, queryClient, selectedVideoId, setSelectedVideoId, setVideos, showToast, videos]);

  return (
    <div className={`h-screen overflow-hidden ${isDark ? "bg-app text-text" : "bg-slate-100 text-slate-900"}`}>
      <Sidebar
        activeTab={activeTab}
        collapsed={sidebarCollapsed}
        isDark={isDark}
        onTabChange={setActiveTab}
        onToggleCollapse={() => setSidebarCollapsed((c) => !c)}
      />

      <main className={`flex h-screen flex-col overflow-hidden transition-all duration-300 pb-14 md:pb-0 ${sidebarCollapsed ? "md:ml-16" : "md:ml-60"}`}>
        <div className="mx-auto flex h-full w-full max-w-[1500px] flex-col px-3 py-3 md:px-8 md:py-6">
          <div className="shrink-0">
            <DashboardHeader
              activeTab={activeTab}
              isDark={isDark}
              notifications={notifications}
              onMarkAllRead={() =>
                setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
              }
              onToggleTheme={() => setIsDark((d) => !d)}
            />
          </div>

          <div className="mt-4 flex min-h-0 flex-1 flex-col overflow-hidden">
            {activeTab === "videos" && (
              <VideoAnalysisTab
                deletingVideoId={deletingId}
                isDark={isDark}
                onDelete={handleDelete}
                onSelectVideo={setSelectedVideoId}
                onVideosChange={setVideos}
                pushNotification={pushNotification}
                selectedVideoId={selectedVideoId}
                videos={videos}
              />
            )}

            {activeTab === "dashboard" && (
              <DashboardTab
                isDark={isDark}
                onGoToVideos={() => setActiveTab("videos")}
                videos={videos}
              />
            )}

            {activeTab === "live" && <LiveMonitorTab isDark={isDark} />}

            {activeTab === "settings" && <SettingsPage isDark={isDark} onSetTheme={setIsDark} />}
          </div>
        </div>
      </main>

      {deleteConfirm && (
        <DeleteConfirmModal
          isDark={isDark}
          label={deleteConfirm.label}
          loading={deletingId === deleteConfirm.id}
          onCancel={() => setDeleteConfirm(null)}
          onConfirm={confirmDelete}
        />
      )}

      {toast && (
        <div className="pointer-events-none fixed bottom-16 right-3 z-60 md:bottom-auto md:right-5 md:top-5">
          <div
            className={`modal-scale-in rounded-xl px-4 py-2 text-sm shadow-lg ${
              toast.kind === "success"
                ? "bg-emerald-600/90 text-white"
                : "bg-red-600/90 text-white"
            }`}
          >
            {toast.text}
          </div>
        </div>
      )}

      {/* Mobile bottom navigation */}
      <nav className={`fixed inset-x-0 bottom-0 z-40 flex h-14 items-center justify-around border-t md:hidden ${isDark ? "border-border-soft bg-surface/95" : "border-slate-200 bg-white/95"}`}>
        {([
          { key: "videos" as ActiveTab, label: "Videos", icon: FileVideo },
          { key: "dashboard" as ActiveTab, label: "Dashboard", icon: BarChart2 },
          { key: "live" as ActiveTab, label: "En vivo", icon: Radio },
          { key: "settings" as ActiveTab, label: "Config.", icon: Settings },
        ] as { key: ActiveTab; label: string; icon: React.ElementType }[]).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => setActiveTab(key)}
            className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] transition-colors ${
              activeTab === key
                ? "text-blue-500"
                : isDark ? "text-muted" : "text-slate-500"
            }`}
          >
            <Icon className="h-5 w-5" />
            {label}
          </button>
        ))}
      </nav>
    </div>
  );
}
