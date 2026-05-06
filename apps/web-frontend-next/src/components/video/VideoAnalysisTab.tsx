"use client";

import { EmptyState } from "@/components/ui/FetchStates";
import { VideoPlayer } from "@/components/video/VideoPlayer";
import { queryKeys } from "@/lib/query-keys";
import { processedService } from "@/services/processedService";
import { videoService } from "@/services/videoService";
import { useNameMapStore } from "@/store/videoStore";
import type { Detection, ProcessedVideoInfo, VideoItem } from "@/types/video";
import type { VideoMetaInfo } from "@/components/video/VideoPlayer";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { RealTimeStatsPanel } from "@/components/video/RealTimeStatsPanel";
import {
  ArrowLeft,
  Calendar,
  Clock,
  FileVideo,
  HardDrive,
  Loader2,
  Play,
  ScanSearch,
  Trash2,
  Zap,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return "N/D";
  if (bytes < 1_048_576) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1_048_576).toFixed(1)} MB`;
}

function formatDuration(s: number) {
  if (!Number.isFinite(s) || s <= 0) return "—";
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
}

function formatDate(input: string) {
  if (!input) return "—";
  const d = new Date(input);
  return Number.isNaN(d.getTime())
    ? input
    : d.toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" });
}

type SubView = "library" | "analysis";

export function VideoAnalysisTab({
  videos,
  selectedVideoId,
  isDark,
  deletingVideoId,
  onDelete,
  onSelectVideo,
  onVideosChange,
  pushNotification,
}: {
  videos: VideoItem[];
  selectedVideoId: string | null;
  isDark: boolean;
  deletingVideoId: string | null;
  onDelete: (id: string) => void;
  onSelectVideo: (id: string) => void;
  onVideosChange: (videos: VideoItem[]) => void;
  pushNotification: (type: "upload" | "processed" | "error", filename: string) => void;
}) {
  const { nameMap } = useNameMapStore();
  const queryClient = useQueryClient();
  const [subView, setSubView] = useState<SubView>("library");
  const [syncTime, setSyncTime] = useState(0);
  const [processing, setProcessing] = useState(false);
  const [processStage, setProcessStage] = useState("");
  const [processProgress, setProcessProgress] = useState(0);
  const [processedInfo, setProcessedInfo] = useState<ProcessedVideoInfo | null>(null);

  const selectedVideo = useMemo(
    () => videos.find((v) => v.id === selectedVideoId) ?? null,
    [videos, selectedVideoId],
  );

  // Auto-select first video when none is selected
  useEffect(() => {
    if (!selectedVideoId && videos.length > 0) {
      onSelectVideo(videos[0]!.id);
    }
  }, [selectedVideoId, videos, onSelectVideo]);

  // Auto-load processed info when switching to an already-processed video
  useEffect(() => {
    if (!selectedVideo) { setProcessedInfo(null); return; }
    if (!selectedVideo.has_processed) { setProcessedInfo(null); return; }
    processedService.getProcessedVideo(selectedVideo.id)
      .then(setProcessedInfo)
      .catch(() => setProcessedInfo(null));
  }, [selectedVideo?.id, selectedVideo?.has_processed]);

  const { data: videoMeta } = useQuery({
    queryKey: queryKeys.videoMetadata(selectedVideoId ?? ""),
    queryFn: () => videoService.getVideoMetadata(selectedVideoId!),
    enabled: !!selectedVideoId,
    staleTime: Infinity,
  });

  const videoInfo = useMemo<VideoMetaInfo | undefined>(() => {
    if (!videoMeta) return undefined;
    return {
      fps: videoMeta.fps != null ? Math.round(videoMeta.fps * 100) / 100 : undefined,
      size: formatBytes(videoMeta.size),
      resolution: videoMeta.width && videoMeta.height
        ? `${videoMeta.width}x${videoMeta.height}`
        : undefined,
      duration: videoMeta.duration,
    };
  }, [videoMeta]);

  const { data: detections } = useQuery<Detection[]>({
    queryKey: queryKeys.detections(selectedVideoId ?? ""),
    queryFn: () => processedService.getDetections(selectedVideoId!),
    enabled: !!selectedVideoId && !!processedInfo,
  });

  const handleAnalyzeClick = useCallback(async (videoId: string) => {
    const target = videos.find((v) => v.id === videoId);
    if (!target) return;

    onSelectVideo(videoId);
    setSubView("analysis");

    if (target.has_processed) return;

    setProcessing(true);
    setProcessProgress(8);
    setProcessStage("Analizando video...");
    const timer = window.setInterval(
      () => setProcessProgress((p) => (p < 92 ? p + 6 : p)),
      700,
    );
    try {
      await videoService.processVideo(target.id);
      setProcessStage("Cargando resultado...");
      const result = await processedService.getProcessedVideo(target.id);
      setProcessedInfo(result);
      onVideosChange(
        videos.map((v) => v.id === target.id ? { ...v, has_processed: true } : v),
      );
      void queryClient.invalidateQueries({ queryKey: queryKeys.jobs(target.id) });
      setProcessProgress(100);
      pushNotification("processed", target.filename);
    } catch {
      pushNotification("error", target.filename);
      setSubView("library");
    } finally {
      window.clearInterval(timer);
      setProcessing(false);
      window.setTimeout(() => setProcessProgress(0), 800);
    }
  }, [videos, onSelectVideo, onVideosChange, pushNotification, queryClient]);

  const processedUrl = selectedVideo && processedInfo
    ? `${processedService.getProcessedStreamUrl(selectedVideo.id)}?v=${encodeURIComponent(processedInfo.processed_filename)}`
    : null;

  const processedDownloadUrl = selectedVideo
    ? processedService.getDownloadUrl(selectedVideo.id)
    : undefined;

  const fps = videoMeta?.fps ?? 23.98;
  const currentFrame = Math.max(0, Math.floor(syncTime * fps));

  // ── Empty state ──────────────────────────────────────────────────────────
  if (videos.length === 0) {
    return (
      <section className={`grid min-h-80 place-items-center rounded-2xl border-2 border-dashed p-6 ${isDark ? "border-[rgba(255,255,255,0.12)] bg-surface" : "border-slate-300 bg-white"}`}>
        <div className="text-center">
          <FileVideo className={`mx-auto h-12 w-12 ${isDark ? "text-muted" : "text-slate-400"}`} />
          <h3 className="mt-3 text-lg font-semibold">No hay videos disponibles</h3>
          <p className={`mt-1 text-sm ${isDark ? "text-muted" : "text-slate-600"}`}>
            Contacta al administrador para cargar videos al sistema.
          </p>
        </div>
      </section>
    );
  }

  // ── ANÁLISIS sub-view ────────────────────────────────────────────────────
  if (subView === "analysis") {
    return (
      <section className="flex h-full flex-col gap-3">
        {/* Header */}
        <div className={`flex shrink-0 items-center gap-3 rounded-xl border px-4 py-3 ${isDark ? "border-slate-800 bg-white/2" : "border-slate-200 bg-white"}`}>
          <button
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${isDark ? "border-slate-700 text-slate-300 hover:bg-white/5" : "border-slate-300 text-slate-700 hover:bg-slate-100"}`}
            onClick={() => setSubView("library")}
            type="button"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Volver
          </button>
          {selectedVideo && (
            <span className={`min-w-0 truncate text-sm font-medium ${isDark ? "text-text" : "text-slate-900"}`}>
              {nameMap[selectedVideo.id] ?? selectedVideo.filename}
            </span>
          )}
          <span className={`ml-auto inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs ${isDark ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>
            <Zap className="h-3 w-3" />
            YOLOv8 · Conteo de productos en cinta
          </span>
        </div>

        {/* Processing progress */}
        {(processing || processProgress > 0) && (
          <div className={`shrink-0 rounded-xl border p-3 ${isDark ? "border-[rgba(255,255,255,0.08)] bg-surface-2" : "border-slate-200 bg-white"}`}>
            <div className="mb-2 flex items-center justify-between text-xs">
              <span className={`inline-flex items-center gap-2 ${isDark ? "text-muted" : "text-slate-600"}`}>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                {processStage}
              </span>
              <span className="font-mono">{processProgress}%</span>
            </div>
            <div className={`relative h-2 w-full overflow-hidden rounded-full ${isDark ? "bg-slate-700" : "bg-slate-200"}`}>
              <div
                className="relative h-2 rounded-full bg-emerald-500 transition-all duration-500"
                style={{ width: `${processProgress}%` }}
              >
                <span className="progress-shimmer" />
              </div>
            </div>
          </div>
        )}

        {/* Processed video + stats */}
        <div className="flex min-h-0 flex-1 gap-4 overflow-hidden">
          <div className="min-w-0 flex-1 overflow-y-auto overflow-x-hidden">
            {!processedUrl && !processing ? (
              <EmptyState
                description="El análisis está en progreso o no se pudo cargar el video procesado."
                icon={ScanSearch}
                isDark={isDark}
                title="Procesando video..."
              />
            ) : processedUrl ? (
              <VideoPlayer
                key={`proc-${selectedVideo?.id ?? ""}`}
                downloadLabel="Descargar video analizado"
                downloadUrl={processedDownloadUrl}
                fileName={selectedVideo ? `${nameMap[selectedVideo.id] ?? selectedVideo.filename} (analizado)` : undefined}
                info={videoInfo}
                isDark={isDark}
                metadataSourceLabel="Analizado"
                onTimeUpdate={setSyncTime}
                overlayBadge="Detección de productos · YOLO"
                title="Video analizado"
                videoUrl={processedUrl}
              />
            ) : null}
          </div>
          <div className="hidden w-64 shrink-0 overflow-x-hidden overflow-y-auto xl:block">
            <RealTimeStatsPanel
              currentFrame={currentFrame}
              detections={detections ?? []}
              hasProcessed={!!processedInfo}
              isDark={isDark}
              syncTime={syncTime}
              videoId={selectedVideoId}
            />
          </div>
        </div>
      </section>
    );
  }

  // ── LIBRERÍA (lista + preview original) ─────────────────────────────────
  return (
    <section className="flex h-full flex-col gap-3 overflow-hidden md:flex-row md:gap-4">
      {/* Left: video list */}
      <div className="flex w-full shrink-0 flex-col gap-2 overflow-y-auto pr-0 md:w-72 md:max-h-none md:pr-1 max-h-52">
        {/* Header */}
        <div className={`shrink-0 rounded-xl border px-3 py-2.5 ${isDark ? "border-slate-800 bg-white/2" : "border-slate-200 bg-white"}`}>
          <h2 className={`text-xs font-semibold ${isDark ? "text-text" : "text-slate-900"}`}>
            Videos disponibles
          </h2>
          <p className={`mt-0.5 text-[10px] ${isDark ? "text-muted" : "text-slate-500"}`}>
            {videos.length} video{videos.length !== 1 ? "s" : ""} · YOLOv8
          </p>
        </div>

        {/* List items */}
        {videos.map((video) => {
          const displayName = nameMap[video.id] ?? video.filename;
          const isDeleting = deletingVideoId === video.id;
          const isSelected = video.id === selectedVideoId;
          return (
            <div
              key={video.id}
              className={`group relative flex w-full cursor-pointer gap-3 rounded-xl border p-3 text-left transition-all ${
                isSelected
                  ? isDark
                    ? "border-emerald-500/40 bg-emerald-500/10"
                    : "border-emerald-400 bg-emerald-50"
                  : isDark
                    ? "border-slate-800 bg-white/2 hover:border-slate-700 hover:bg-white/4"
                    : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
              }`}
              onClick={() => onSelectVideo(video.id)}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onSelectVideo(video.id); }}
              role="button"
              tabIndex={0}
            >
              {/* Thumbnail */}
              <div className="relative aspect-video w-20 shrink-0 overflow-hidden rounded-lg bg-black">
                {video.thumbnail_url ? (
                  <img alt={displayName} className="h-full w-full object-cover" src={video.thumbnail_url} />
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <FileVideo className={`h-5 w-5 ${isDark ? "text-slate-700" : "text-slate-300"}`} />
                  </div>
                )}
                {video.has_processed && (
                  <span className="absolute bottom-0.5 left-0.5 rounded bg-emerald-500/90 px-1 py-px text-[8px] font-medium text-white">
                    ✓
                  </span>
                )}
              </div>

              {/* Info */}
              <div className="min-w-0 flex-1">
                <p className={`truncate text-xs font-medium ${isDark ? "text-text" : "text-slate-900"}`} title={displayName}>
                  {displayName}
                </p>
                <div className={`mt-1 flex flex-wrap gap-x-2 gap-y-0.5 text-[10px] ${isDark ? "text-muted" : "text-slate-500"}`}>
                  <span className="inline-flex items-center gap-0.5">
                    <Clock className="h-2.5 w-2.5" />
                    {formatDuration(video.duration)}
                  </span>
                  <span className="inline-flex items-center gap-0.5">
                    <HardDrive className="h-2.5 w-2.5" />
                    {formatBytes(video.size ?? 0)}
                  </span>
                  <span className="inline-flex items-center gap-0.5">
                    <Calendar className="h-2.5 w-2.5" />
                    {formatDate(video.uploaded_at)}
                  </span>
                </div>
                <span className={`mt-1.5 inline-block rounded px-1.5 py-px text-[9px] font-medium ${isDark ? "bg-blue-500/10 text-blue-400" : "bg-blue-50 text-blue-700"}`}>
                  Conteo en cinta
                </span>
              </div>

              {/* Delete */}
              <button
                aria-label="Eliminar video"
                className={`absolute right-2 top-2 rounded-lg p-1 opacity-0 transition-all group-hover:opacity-100 ${isDark ? "bg-black/50 text-slate-400 hover:bg-red-500/80 hover:text-white" : "bg-white/80 text-slate-500 hover:bg-red-500 hover:text-white"}`}
                disabled={isDeleting}
                onClick={(e) => { e.stopPropagation(); onDelete(video.id); }}
                type="button"
              >
                {isDeleting
                  ? <Loader2 className="h-3 w-3 animate-spin" />
                  : <Trash2 className="h-3 w-3" />}
              </button>
            </div>
          );
        })}
      </div>

      {/* Right: original video preview */}
      <div className="flex min-w-0 flex-1 flex-col gap-3 overflow-hidden">
        {selectedVideo ? (
          <>
            {/* Toolbar: model badge + action button */}
            <div className={`flex shrink-0 items-center justify-between rounded-xl border px-4 py-2.5 ${isDark ? "border-slate-800 bg-white/2" : "border-slate-200 bg-white"}`}>
              <span className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs ${isDark ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>
                <Zap className="h-3 w-3" />
                YOLOv8 · Conteo de productos en cinta
              </span>
              <button
                className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-all ${
                  selectedVideo.has_processed
                    ? "bg-emerald-600 text-white hover:bg-emerald-500"
                    : "bg-blue-600 text-white hover:bg-blue-500"
                }`}
                onClick={() => void handleAnalyzeClick(selectedVideo.id)}
                type="button"
              >
                {selectedVideo.has_processed
                  ? <><Play className="h-4 w-4" /> Ver análisis</>
                  : <><ScanSearch className="h-4 w-4" /> Procesar video</>}
              </button>
            </div>

            {/* Original video player */}
            <div className="min-h-0 flex-1 overflow-hidden">
              <VideoPlayer
                key={`orig-${selectedVideo.id}`}
                downloadLabel="Descargar video original"
                downloadUrl={videoService.getDownloadUrl(selectedVideo.id)}
                fileName={nameMap[selectedVideo.id] ?? selectedVideo.filename}
                info={videoInfo}
                isDark={isDark}
                metadataSourceLabel="Original"
                title="Video original"
                videoUrl={videoService.getVideoStreamUrl(selectedVideo.id)}
              />
            </div>
          </>
        ) : (
          <div className={`grid flex-1 place-items-center rounded-2xl border-2 border-dashed ${isDark ? "border-slate-800" : "border-slate-200 bg-white"}`}>
            <div className="text-center">
              <Play className={`mx-auto h-10 w-10 ${isDark ? "text-slate-700" : "text-slate-300"}`} />
              <p className={`mt-3 text-sm ${isDark ? "text-muted" : "text-slate-500"}`}>
                Selecciona un video de la lista para previsualizarlo
              </p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
