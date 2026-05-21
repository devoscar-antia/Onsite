"use client";

import { useEffect, useRef, useState } from "react";
import { Activity, AlertCircle, Camera, Loader2, Radio, WifiOff } from "lucide-react";

interface StreamStatus {
  available: boolean;
  source: "rtsp" | "video_loop" | null;
  model_loaded: boolean;
}

interface StreamStats {
  count: number;
  total_count: number;
  fps: number;
  source: string | null;
  model_loaded: boolean;
}

export default function LiveMonitorTab({ isDark }: { isDark: boolean }) {
  const [status, setStatus] = useState<StreamStatus | null>(null);
  const [streaming, setStreaming] = useState(false);
  const [conf, setConf] = useState(0.35);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<StreamStats | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const streamKey = useRef(0);
  const statsIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    fetch("/api/proxy/stream/status")
      .then((r) => r.json())
      .then((d: StreamStatus) => setStatus(d))
      .catch(() => setStatus({ available: false, source: null, model_loaded: false }));
  }, []);

  // Poll stats while streaming
  useEffect(() => {
    if (streaming) {
      const poll = () => {
        fetch("/api/proxy/stream/stats")
          .then((r) => r.json())
          .then((d: StreamStats) => setStats(d))
          .catch(() => null);
      };
      poll();
      statsIntervalRef.current = setInterval(poll, 1000);
    } else {
      if (statsIntervalRef.current) clearInterval(statsIntervalRef.current);
      setStats(null);
    }
    return () => { if (statsIntervalRef.current) clearInterval(statsIntervalRef.current); };
  }, [streaming]);

  const startStream = () => {
    streamKey.current += 1;
    setError(null);
    setStreaming(true);
  };

  const stopStream = () => {
    setStreaming(false);
    if (imgRef.current) imgRef.current.src = "";
  };

  const sourceLabel = status?.source === "rtsp"
    ? "Cámara RTSP"
    : status?.source === "video_loop"
      ? "Video en loop (simulación)"
      : "Sin fuente";

  return (
    <div className="flex flex-1 min-h-0 flex-col gap-4">
      {/* Header bar */}
      <div className={`shrink-0 rounded-2xl border p-4 ${isDark ? "border-border-soft bg-surface" : "border-slate-200 bg-white"}`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${streaming ? "bg-red-500/15" : isDark ? "bg-white/5" : "bg-slate-100"}`}>
              {streaming
                ? <Radio className="h-4 w-4 animate-pulse text-red-400" />
                : <Camera className={`h-4 w-4 ${isDark ? "text-slate-400" : "text-slate-500"}`} />
              }
            </div>
            <div>
              <p className={`text-sm font-medium ${isDark ? "text-white" : "text-slate-900"}`}>
                Monitoreo en vivo
              </p>
              <p className={`text-xs ${isDark ? "text-slate-500" : "text-slate-400"}`}>
                {status === null ? "Verificando..." : sourceLabel}
                {status?.model_loaded && (
                  <span className="ml-2 text-emerald-400">· YOLO activo</span>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Confidence slider */}
            <div className="flex items-center gap-2">
              <span className={`text-xs ${isDark ? "text-slate-500" : "text-slate-400"}`}>Conf</span>
              <input
                className="h-1.5 w-24 cursor-pointer accent-blue-500"
                disabled={streaming}
                max="0.9"
                min="0.1"
                onChange={(e) => setConf(parseFloat(e.target.value))}
                step="0.05"
                title={`Confianza: ${conf}`}
                type="range"
                value={conf}
              />
              <span className={`w-8 text-xs font-mono ${isDark ? "text-slate-400" : "text-slate-600"}`}>
                {conf.toFixed(2)}
              </span>
            </div>

            {/* Start / Stop */}
            {!streaming ? (
              <button
                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-500 disabled:opacity-50"
                disabled={!status?.available}
                onClick={startStream}
                type="button"
              >
                <Activity className="h-4 w-4" />
                Iniciar stream
              </button>
            ) : (
              <button
                className="inline-flex items-center gap-2 rounded-xl border border-red-500/30 px-4 py-2 text-sm font-medium text-red-400 transition hover:bg-red-500/10"
                onClick={stopStream}
                type="button"
              >
                Detener
              </button>
            )}
          </div>
        </div>

        {/* Stats row — visible only while streaming */}
        {streaming && (
          <div className={`mt-3 flex flex-wrap items-center gap-6 border-t pt-3 ${isDark ? "border-slate-800" : "border-slate-200"}`}>
            <div className="flex items-center gap-2">
              <span className={`text-[11px] ${isDark ? "text-slate-500" : "text-slate-400"}`}>Total contados</span>
              <span className="font-mono text-lg font-bold text-blue-400">
                {stats?.total_count ?? 0}
              </span>
            </div>
            <div className={`h-4 w-px ${isDark ? "bg-slate-700" : "bg-slate-300"}`} />
            <div className="flex items-center gap-2">
              <span className={`text-[11px] ${isDark ? "text-slate-500" : "text-slate-400"}`}>En frame</span>
              <span className={`font-mono text-sm font-semibold ${isDark ? "text-text" : "text-slate-800"}`}>
                {stats?.count ?? 0}
              </span>
            </div>
            <div className={`h-4 w-px ${isDark ? "bg-slate-700" : "bg-slate-300"}`} />
            <div className="flex items-center gap-2">
              <span className={`text-[11px] ${isDark ? "text-slate-500" : "text-slate-400"}`}>FPS</span>
              <span className={`font-mono text-sm font-semibold ${isDark ? "text-text" : "text-slate-800"}`}>
                {stats?.fps ?? 0}
              </span>
            </div>
            <div className={`h-4 w-px ${isDark ? "bg-slate-700" : "bg-slate-300"}`} />
            <div className="flex items-center gap-2">
              <span className={`text-[11px] ${isDark ? "text-slate-500" : "text-slate-400"}`}>Modelo</span>
              <span className={`text-sm font-semibold ${stats?.model_loaded ? "text-emerald-400" : "text-slate-500"}`}>
                {stats?.model_loaded ? "YOLOv8 · activo" : "cargando..."}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Stream viewer */}
      <div className={`relative flex flex-1 min-h-0 items-center justify-center overflow-hidden rounded-2xl border ${isDark ? "border-border-soft bg-black" : "border-slate-200 bg-slate-950"}`}>
        {!streaming && !error && (
          <div className="flex flex-col items-center gap-3 text-center">
            {status === null ? (
              <Loader2 className="h-8 w-8 animate-spin text-slate-500" />
            ) : !status.available ? (
              <>
                <WifiOff className="h-10 w-10 text-slate-600" />
                <p className="text-sm text-slate-400">Sin fuente de video disponible</p>
                <p className="text-xs text-slate-600">Sube un video o configura RTSP_URL</p>
              </>
            ) : (
              <>
                <Camera className="h-10 w-10 text-slate-600" />
                <p className="text-sm text-slate-400">Presiona <span className="text-blue-400">Iniciar stream</span> para comenzar</p>
                <p className="text-xs text-slate-600">{sourceLabel}</p>
              </>
            )}
          </div>
        )}

        {error && (
          <div className="flex flex-col items-center gap-2 text-center">
            <AlertCircle className="h-8 w-8 text-red-400" />
            <p className="text-sm text-red-400">{error}</p>
            <button className="text-xs text-blue-400 hover:text-blue-300" onClick={startStream} type="button">
              Reintentar
            </button>
          </div>
        )}

        {streaming && (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            ref={imgRef}
            alt="Live stream"
            className="max-h-full max-w-full object-contain"
            key={streamKey.current}
            onError={() => {
              setStreaming(false);
              setError("Error al conectar con el stream. Verifica que el backend esté activo.");
            }}
            src={`/api/proxy/stream/live?conf=${conf}&t=${streamKey.current}`}
          />
        )}

        {/* Live badge */}
        {streaming && (
          <div className="absolute left-3 top-3 flex items-center gap-1.5 rounded-lg bg-black/70 px-2.5 py-1 backdrop-blur-sm">
            <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
            <span className="text-xs font-semibold text-white">EN VIVO</span>
          </div>
        )}

        {/* FPS badge */}
        {streaming && stats && (
          <div className="absolute right-3 top-3 rounded-lg bg-black/70 px-2.5 py-1 backdrop-blur-sm">
            <span className="font-mono text-xs text-slate-300">{stats.fps} fps</span>
          </div>
        )}
      </div>

    </div>
  );
}