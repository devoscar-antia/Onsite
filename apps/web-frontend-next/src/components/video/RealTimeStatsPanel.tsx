"use client";

import { analyticsService } from "@/services/analyticsService";
import { videoService } from "@/services/videoService";
import { queryKeys } from "@/lib/query-keys";
import type { Detection } from "@/types/video";
import { useQuery } from "@tanstack/react-query";
import { BarChart2, CheckCircle2, Layers, PackageCheck, Target } from "lucide-react";
import { useMemo } from "react";

const CLASS_COLORS = [
  "#3B82F6", "#6EE7B7", "#A78BFA", "#F87171",
  "#FBBF24", "#60A5FA", "#34D399", "#F472B6",
];

export function RealTimeStatsPanel({
  detections,
  currentFrame,
  syncTime,
  isDark = true,
  videoId,
  hasProcessed,
}: {
  detections: Detection[];
  currentFrame: number;
  syncTime: number;
  isDark?: boolean;
  videoId: string | null;
  hasProcessed: boolean;
}) {
  const card = isDark
    ? "border-[rgba(255,255,255,0.06)] bg-surface"
    : "border-slate-200 bg-white";

  const enabled = !!videoId && hasProcessed;

  const { data: summary } = useQuery({
    queryKey: queryKeys.analytics.summary(videoId ?? ""),
    queryFn: () => analyticsService.getSummary(videoId!),
    enabled,
    staleTime: Infinity,
  });

  const { data: classDist } = useQuery({
    queryKey: queryKeys.analytics.classDistribution(videoId ?? ""),
    queryFn: () => analyticsService.getClassDistribution(videoId!),
    enabled,
    staleTime: Infinity,
  });

  const { data: jobs } = useQuery({
    queryKey: queryKeys.jobs(videoId ?? ""),
    queryFn: () => videoService.getJobs(videoId!),
    enabled,
    staleTime: Infinity,
  });

  // Real count = ByteTrack line-crossing from the latest completed job
  const realCount = useMemo(() => {
    if (!jobs) return null;
    const done = [...jobs].reverse().find((j) => j.status === "done" && j.total_count != null);
    return done?.total_count ?? null;
  }, [jobs]);

  // Detections exactly at current frame
  const atFrame = useMemo(
    () => detections.filter((d) => d.frame === currentFrame),
    [detections, currentFrame],
  );

  // Mini timeline: detections per frame bucket (50 buckets)
  const timeline = useMemo(() => {
    if (detections.length === 0) return [];
    const maxF = Math.max(1, detections[detections.length - 1]?.frame ?? 1);
    const BUCKETS = 50;
    const buckets = new Array<number>(BUCKETS).fill(0);
    for (const d of detections) {
      const idx = Math.min(BUCKETS - 1, Math.floor((d.frame / maxF) * BUCKETS));
      buckets[idx]++;
    }
    const maxVal = Math.max(...buckets, 1);
    return buckets.map((v) => v / maxVal);
  }, [detections]);

  const timelinePos = useMemo(() => {
    const maxF = detections[detections.length - 1]?.frame ?? 1;
    return Math.min(1, currentFrame / maxF);
  }, [currentFrame, detections]);

  const coveragePct = summary
    ? Math.round((summary.frames_with_detections / summary.total_frames) * 100)
    : null;

  return (
    <div className="flex h-full flex-col gap-3 overflow-y-auto">
      {/* Header */}
      <div className={`flex items-center gap-2 rounded-xl border px-3 py-2 ${card}`}>
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
        <span className={`text-xs font-medium ${isDark ? "text-slate-300" : "text-slate-700"}`}>
          Estadísticas del video
        </span>
        <span className={`ml-auto font-mono text-[10px] ${isDark ? "text-slate-600" : "text-slate-400"}`}>
          t={syncTime.toFixed(1)}s · #{currentFrame}
        </span>
      </div>

      {/* Real product count — prominent card */}
      {realCount != null && (
        <div className={`rounded-xl border p-4 ${card}`}>
          <div className="flex items-center gap-2">
            <CheckCircle2 className={`h-4 w-4 ${realCount > 0 ? "text-emerald-400" : "text-slate-500"}`} />
            <span className={`text-xs font-medium ${isDark ? "text-slate-400" : "text-slate-600"}`}>
              Productos contados (ByteTrack)
            </span>
          </div>
          {realCount != null && realCount > 0 ? (
            <>
              <p className="mt-2 font-mono text-3xl font-bold text-emerald-400">
                {realCount.toLocaleString("es-CO")}
              </p>
              <p className={`mt-0.5 text-[10px] ${isDark ? "text-slate-600" : "text-slate-400"}`}>
                Objetos únicos que cruzaron la línea de conteo
              </p>
            </>
          ) : summary?.unique_tracked_objects != null && summary.unique_tracked_objects > 0 ? (
            <>
              <p className="mt-2 font-mono text-3xl font-bold text-blue-400">
                {summary.unique_tracked_objects.toLocaleString("es-CO")}
              </p>
              <p className={`mt-0.5 text-[10px] ${isDark ? "text-slate-600" : "text-slate-400"}`}>
                Objetos únicos rastreados (YOLO tracking)
              </p>
            </>
          ) : (
            <>
              <p className={`mt-2 font-mono text-xl font-semibold ${isDark ? "text-slate-500" : "text-slate-400"}`}>
                N/D
              </p>
              <p className={`mt-0.5 text-[10px] ${isDark ? "text-slate-600" : "text-slate-400"}`}>
                Analiza el video para obtener el conteo
              </p>
            </>
          )}
        </div>
      )}

      {/* Summary KPIs */}
      {summary ? (
        <div className="grid grid-cols-2 gap-2">
          {[
            {
              icon: PackageCheck,
              label: "Confianza prom.",
              value: `${Math.round(summary.avg_confidence * 100)}%`,
              color: "text-blue-400",
            },
            {
              icon: Target,
              label: "Cobertura",
              value: coveragePct !== null ? `${coveragePct}%` : "N/D",
              color: "text-emerald-400",
            },
            {
              icon: Layers,
              label: "Clases únicas",
              value: summary.unique_classes,
              color: "text-amber-400",
            },
            {
              icon: BarChart2,
              label: "Total raw YOLO",
              value: summary.total_detections.toLocaleString("es-CO"),
              color: "text-slate-500",
            },
          ].map(({ icon: Icon, label, value, color }) => (
            <div key={label} className={`rounded-xl border p-3 ${card}`}>
              <Icon className={`h-3.5 w-3.5 ${color}`} />
              <p className="mt-1.5 font-mono text-xl font-semibold">{value}</p>
              <p className={`text-[10px] ${isDark ? "text-muted" : "text-slate-500"}`}>{label}</p>
            </div>
          ))}
        </div>
      ) : (
        <div className={`rounded-xl border p-4 text-center ${card}`}>
          <p className={`text-xs ${isDark ? "text-slate-600" : "text-slate-400"}`}>
            {hasProcessed ? "Cargando estadísticas..." : "Procesa el video para ver estadísticas"}
          </p>
        </div>
      )}

      {/* Class distribution */}
      {classDist && classDist.length > 0 && (
        <div className={`rounded-xl border p-3 ${card}`}>
          <p className={`mb-2.5 text-[10px] font-medium ${isDark ? "text-slate-500" : "text-slate-500"}`}>
            Distribución por clase
          </p>
          <div className="space-y-2.5">
            {classDist.slice(0, 6).map((item, idx) => (
              <div key={item.class}>
                <div className="mb-1 flex items-center justify-between gap-1">
                  <span
                    className="max-w-25 truncate rounded-full px-2 py-0.5 text-[10px] font-medium"
                    style={{
                      background: `${CLASS_COLORS[idx % CLASS_COLORS.length]}22`,
                      color: CLASS_COLORS[idx % CLASS_COLORS.length],
                    }}
                  >
                    {item.class}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className={`font-mono text-[10px] ${isDark ? "text-slate-400" : "text-slate-600"}`}>
                      {item.count.toLocaleString("es-CO")}
                    </span>
                    <span className={`text-[9px] ${isDark ? "text-slate-600" : "text-slate-400"}`}>
                      ({item.percentage.toFixed(1)}%)
                    </span>
                  </div>
                </div>
                <div className={`h-1 overflow-hidden rounded-full ${isDark ? "bg-slate-800" : "bg-slate-200"}`}>
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${item.percentage}%`,
                      background: CLASS_COLORS[idx % CLASS_COLORS.length],
                    }}
                  />
                </div>
                <p className={`mt-0.5 text-right text-[9px] ${isDark ? "text-slate-600" : "text-slate-400"}`}>
                  conf. prom. {Math.round(item.avg_confidence * 100)}%
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Mini activity timeline */}
      {timeline.length > 0 && (
        <div className={`rounded-xl border p-3 ${card}`}>
          <p className={`mb-2 text-[10px] font-medium ${isDark ? "text-slate-500" : "text-slate-500"}`}>
            Actividad de detección
          </p>
          <div className="flex h-10 items-end gap-0.5">
            {timeline.map((v, i) => {
              const isCurrent = Math.abs(i / timeline.length - timelinePos) < 1 / timeline.length;
              return (
                <div
                  key={i}
                  className="flex-1 rounded-sm transition-all duration-100"
                  style={{
                    height: `${Math.max(4, v * 100)}%`,
                    background: isCurrent
                      ? "#3B82F6"
                      : isDark
                        ? `rgba(99,102,241,${0.2 + v * 0.6})`
                        : `rgba(99,102,241,${0.15 + v * 0.5})`,
                  }}
                />
              );
            })}
          </div>
          <div className="mt-1.5 flex justify-between font-mono text-[9px] text-slate-600">
            <span>inicio</span>
            <span>fin</span>
          </div>
        </div>
      )}

      {/* Current frame detections */}
      {atFrame.length > 0 && (
        <div className={`rounded-xl border p-3 ${card}`}>
          <p className={`mb-2 text-[10px] font-medium ${isDark ? "text-slate-500" : "text-slate-500"}`}>
            Frame #{currentFrame} · {atFrame.length} detección{atFrame.length !== 1 ? "es" : ""}
          </p>
          <div className="space-y-1.5">
            {atFrame.map((det, i) => {
              const pct = Math.round(det.confidence * 100);
              return (
                <div key={i} className="flex items-center justify-between gap-2">
                  <span className="rounded-md border border-emerald-500/20 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-400">
                    {det.class}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <div className={`h-1 w-12 overflow-hidden rounded-full ${isDark ? "bg-slate-800" : "bg-slate-200"}`}>
                      <div
                        className={`h-full rounded-full ${pct >= 70 ? "bg-emerald-500" : pct >= 50 ? "bg-amber-500" : "bg-red-500"}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="font-mono text-[10px] text-slate-500">{pct}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {atFrame.length === 0 && hasProcessed && detections.length > 0 && (
        <div className={`rounded-xl border px-3 py-3 text-center ${card}`}>
          <p className={`text-xs ${isDark ? "text-slate-600" : "text-slate-400"}`}>
            Sin detecciones en frame #{currentFrame}
          </p>
        </div>
      )}

      {/* Frame-level stats when detections loaded */}
      {detections.length > 0 && (
        <div className={`rounded-xl border p-3 ${card}`}>
          <p className={`mb-2 text-[10px] font-medium ${isDark ? "text-slate-500" : "text-slate-500"}`}>
            Posición actual
          </p>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <p className={`text-[9px] ${isDark ? "text-slate-600" : "text-slate-400"}`}>En frame</p>
              <p className="font-mono text-sm font-semibold text-blue-400">{atFrame.length}</p>
            </div>
            <div>
              <p className={`text-[9px] ${isDark ? "text-slate-600" : "text-slate-400"}`}>Acumulado</p>
              <p className="font-mono text-sm font-semibold text-emerald-400">
                {detections.filter((d) => d.frame <= currentFrame).length.toLocaleString("es-CO")}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}