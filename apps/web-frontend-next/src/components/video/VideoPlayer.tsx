"use client";

import {
  Download,
  ExternalLink,
  Film,
  Loader2,
  Maximize2,
  Pause,
  Play,
  RotateCcw,
  VideoOff,
  Volume2,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

function toTime(seconds: number) {
  if (!Number.isFinite(seconds)) return "00:00";
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
}

export type VideoMetaInfo = {
  resolution?: string;
  fps?: number;
  duration?: number;
  size?: string;
};

type Props = {
  title: string;
  videoUrl?: string | null;
  fileName?: string;
  downloadUrl?: string;
  downloadLabel: string;
  info?: VideoMetaInfo;
  metadataSourceLabel?: string;
  overlayBadge?: string;
  onTimeUpdate?: (seconds: number) => void;
  syncTime?: number;
  isDark?: boolean;
};

export function VideoPlayer({
  title,
  videoUrl,
  fileName,
  downloadUrl,
  downloadLabel,
  info,
  metadataSourceLabel,
  overlayBadge,
  onTimeUpdate,
  syncTime,
  isDark = true,
}: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const frameRef = useRef<HTMLDivElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [current, setCurrent] = useState(0);
  const [volume, setVolume] = useState(0.75);
  const [isBuffering, setIsBuffering] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [runtimeMeta, setRuntimeMeta] = useState<{
    resolution?: string;
    duration?: number;
  }>({});

  useEffect(() => {
    setRuntimeMeta({});
    setCurrent(0);
    setDuration(0);
    setIsBuffering(true);
    setLoadError(null);
  }, [videoUrl]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || syncTime == null || Number.isNaN(syncTime)) return;
    if (Math.abs((video.currentTime || 0) - syncTime) > 0.2)
      video.currentTime = syncTime;
  }, [syncTime]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onLoaded = () => {
      setDuration(video.duration || 0);
      const w = video.videoWidth;
      const h = video.videoHeight;
      setRuntimeMeta((prev) => ({
        ...prev,
        resolution: w && h ? `${w}x${h}` : prev.resolution,
        duration: video.duration || prev.duration,
      }));
    };
    const onTime = () => {
      const t = video.currentTime || 0;
      setCurrent(t);
      onTimeUpdate?.(t);
    };
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onWaiting = () => setIsBuffering(true);
    const onCanPlay = () => setIsBuffering(false);
    const onError = () => {
      setIsBuffering(false);
      const codeMap: Record<number, string> = {
        1: "Carga cancelada.",
        2: "Error de red.",
        3: "Error al decodificar.",
        4: "Formato no soportado.",
      };
      const code = video.error?.code ?? 0;
      setLoadError(codeMap[code] ?? "No fue posible cargar este video.");
    };

    video.addEventListener("loadedmetadata", onLoaded);
    video.addEventListener("timeupdate", onTime);
    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    video.addEventListener("loadstart", () => setIsBuffering(true));
    video.addEventListener("waiting", onWaiting);
    video.addEventListener("canplay", onCanPlay);
    video.addEventListener("error", onError);
    return () => {
      video.removeEventListener("loadedmetadata", onLoaded);
      video.removeEventListener("timeupdate", onTime);
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("waiting", onWaiting);
      video.removeEventListener("canplay", onCanPlay);
      video.removeEventListener("error", onError);
    };
  }, [onTimeUpdate, videoUrl]);

  const pills = useMemo(
    () => [
      { k: "Resolución", v: runtimeMeta.resolution ?? info?.resolution ?? "N/D" },
      { k: "FPS", v: info?.fps ? String(info.fps) : "N/D" },
      {
        k: "Duración",
        v:
          runtimeMeta.duration
            ? toTime(runtimeMeta.duration)
            : info?.duration
              ? toTime(info.duration)
              : "N/D",
      },
      { k: "Tamaño", v: info?.size ?? "N/D" },
    ],
    [info, runtimeMeta],
  );

  if (!videoUrl) {
    return (
      <div className="grid min-h-[420px] place-items-center rounded-2xl border border-[rgba(255,255,255,0.06)] bg-surface p-6">
        <div className="text-center">
          <Film className={`mx-auto h-14 w-14 ${isDark ? "text-muted" : "text-slate-500"}`} />
          <h3 className="mt-3 text-lg font-semibold">
            Selecciona un video de la lista
          </h3>
          <p className={`mt-1 text-sm ${isDark ? "text-muted" : "text-slate-600"}`}>
            {title}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`w-full overflow-hidden space-y-3 rounded-2xl border p-4 shadow-soft ${isDark ? "border-[rgba(255,255,255,0.06)] bg-surface" : "border-slate-200 bg-white"}`}
    >
      <div
        ref={frameRef}
        className="relative overflow-hidden rounded-xl border border-[rgba(255,255,255,0.08)] bg-black"
      >
        {overlayBadge && (
          <span className="absolute left-3 top-3 z-10 rounded-full bg-black/50 px-3 py-1 text-xs text-text backdrop-blur">
            {overlayBadge}
          </span>
        )}
        {isBuffering && !loadError && (
          <div className="absolute inset-0 z-10 grid place-items-center bg-black/55 backdrop-blur-[1px]">
            <div className="inline-flex items-center gap-2 rounded-full bg-black/45 px-3 py-1.5 text-xs text-slate-100">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Cargando video...
            </div>
          </div>
        )}
        {loadError && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 bg-black/90 px-4">
            <VideoOff className="h-8 w-8 text-red-400" />
            <p className="text-center text-sm text-red-400">{loadError}</p>
            <div className="flex gap-2">
              <button
                className="flex items-center gap-1.5 rounded-xl bg-white/10 px-4 py-2 text-xs text-slate-300 hover:bg-white/15"
                onClick={() => {
                  setLoadError(null);
                  setIsBuffering(true);
                  videoRef.current?.load();
                }}
                type="button"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Reintentar
              </button>
              <a
                className="flex items-center gap-1.5 rounded-xl border border-blue-500/20 bg-blue-500/10 px-4 py-2 text-xs text-blue-400 hover:bg-blue-500/20"
                href={videoUrl}
                rel="noopener noreferrer"
                target="_blank"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Abrir directo
              </a>
            </div>
          </div>
        )}
        <video
          className="aspect-video w-full bg-black object-contain"
          playsInline
          preload="metadata"
          ref={videoRef}
          src={videoUrl}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          className={`rounded-lg p-2 ${isDark ? "bg-white/5 hover:bg-white/10" : "bg-slate-100 hover:bg-slate-200"}`}
          onClick={() =>
            videoRef.current?.paused
              ? videoRef.current.play()
              : videoRef.current?.pause()
          }
          type="button"
        >
          {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </button>
        <span className={`min-w-[100px] font-mono text-xs ${isDark ? "text-muted" : "text-slate-600"}`}>
          {toTime(current)} / {toTime(duration)}
        </span>
        <input
          className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-[#334155] accent-primary"
          max={duration || 0}
          min={0}
          onChange={(e) => {
            const t = Number(e.target.value);
            if (videoRef.current) videoRef.current.currentTime = t;
            setCurrent(t);
            onTimeUpdate?.(t);
          }}
          type="range"
          value={current}
        />
        <Volume2 className={`h-4 w-4 ${isDark ? "text-muted" : "text-slate-600"}`} />
        <input
          className="h-1.5 w-20 cursor-pointer appearance-none rounded-full bg-[#334155] accent-primary"
          max={1}
          min={0}
          onChange={(e) => {
            const v = Number(e.target.value);
            if (videoRef.current) videoRef.current.volume = v;
            setVolume(v);
          }}
          step={0.01}
          type="range"
          value={volume}
        />
        <button
          className={`rounded-lg p-2 ${isDark ? "bg-white/5 hover:bg-white/10" : "bg-slate-100 hover:bg-slate-200"}`}
          onClick={() => frameRef.current?.requestFullscreen()}
          type="button"
        >
          <Maximize2 className="h-4 w-4" />
        </button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          {fileName && (
            <span
              className={`max-w-full break-all rounded-full px-2.5 py-1 text-xs ${isDark ? "bg-violet-500/10 text-violet-300" : "bg-violet-100 text-violet-700"}`}
            >
              {fileName}
            </span>
          )}
          {metadataSourceLabel && (
            <span
              className={`rounded-full px-2.5 py-1 text-xs font-medium ${isDark ? "bg-blue-500/10 text-blue-400" : "bg-blue-100 text-blue-700"}`}
            >
              {metadataSourceLabel}
            </span>
          )}
          {pills.map((p) => (
            <span
              key={p.k}
              className={`rounded-full px-2.5 py-1 text-xs ${isDark ? "bg-slate-800 text-slate-200" : "bg-slate-200 text-slate-700"}`}
            >
              {p.k}: {p.v}
            </span>
          ))}
        </div>
        {downloadUrl && (
          <a
            className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-all ${
              downloadLabel.includes("procesado")
                ? "bg-gradient-to-r from-blue-600 to-blue-500 text-white"
                : isDark
                  ? "border border-[rgba(255,255,255,0.08)] bg-surface-2 text-text hover:bg-white/5"
                  : "border border-slate-200 bg-slate-100 text-slate-800 hover:bg-slate-200"
            }`}
            download
            href={downloadUrl}
          >
            <Download className="h-4 w-4" />
            {downloadLabel}
          </a>
        )}
      </div>
    </div>
  );
}
