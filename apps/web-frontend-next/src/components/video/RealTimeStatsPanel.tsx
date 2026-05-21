"use client";

import { analyticsService } from "@/services/analyticsService";
import { videoService } from "@/services/videoService";
import { queryKeys } from "@/lib/query-keys";
import type { Detection } from "@/types/video";
import { useQuery } from "@tanstack/react-query";
import { BarChart2, CheckCircle2, Layers, PackageCheck, Target } from "lucide-react";
import { useMemo } from "react";
import {
  Area,
  AreaChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const CLASS_COLORS = [
  "#3B82F6", "#6EE7B7", "#A78BFA", "#F87171",
  "#FBBF24", "#60A5FA", "#34D399", "#F472B6",
];

const BUCKETS = 60;

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
  const card = isDark ? "border-border-soft bg-surface" : "border-slate-200 bg-white";
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

  const realCount = useMemo(() => {
    if (!jobs) return null;
    const done = [...jobs].reverse().find((j) => j.status === "done" && j.total_count != null);
    return done?.total_count ?? null;
  }, [jobs]);

  // Total unique track_ids across all detections (denominator for scaling)
  const totalUniqueIds = useMemo(() => {
    const ids = new Set<number>();
    for (const d of detections) {
      if (d.track_id != null && d.track_id >= 0) ids.add(d.track_id);
    }
    return ids.size;
  }, [detections]);

  // Unique track_ids seen up to currentFrame — scaled to realCount so it
  // reaches the final value at the end of the video.
  const liveCount = useMemo(() => {
    if (!detections.length) return null;
    const seen = new Set<number>();
    for (const d of detections) {
      if (d.frame > currentFrame) break; // detections sorted by frame
      if (d.track_id != null && d.track_id >= 0) seen.add(d.track_id);
    }
    if (seen.size === 0) return 0;
    if (realCount != null && realCount > 0 && totalUniqueIds > 0) {
      return Math.min(realCount, Math.round((seen.size / totalUniqueIds) * realCount));
    }
    return seen.size;
  }, [detections, currentFrame, realCount, totalUniqueIds]);

  const atFrame = useMemo(
    () => detections.filter((d) => d.frame === currentFrame),
    [detections, currentFrame],
  );

  // Build timeline data for AreaChart (BUCKETS buckets)
  const { timelineData, currentBucket } = useMemo(() => {
    if (detections.length === 0) return { timelineData: [], currentBucket: 0 };
    const maxF = Math.max(1, detections[detections.length - 1]?.frame ?? 1);
    const buckets = new Array<number>(BUCKETS).fill(0);
    for (const d of detections) {
      const idx = Math.min(BUCKETS - 1, Math.floor((d.frame / maxF) * BUCKETS));
      buckets[idx]++;
    }
    const data = buckets.map((count, i) => ({ bucket: i, count }));
    const cur = Math.min(BUCKETS - 1, Math.floor((currentFrame / maxF) * BUCKETS));
    return { timelineData: data, currentBucket: cur };
  }, [detections, currentFrame]);

  const coveragePct = summary
    ? Math.round((summary.frames_with_detections / summary.total_frames) * 100)
    : null;

  const tooltipStyle = {
    background: isDark ? "#0D1117" : "#ffffff",
    border: isDark ? "1px solid rgba(255,255,255,0.08)" : "1px solid #e2e8f0",
    borderRadius: 8,
    fontSize: 11,
    padding: "4px 8px",
  };

  return (
    <div className="flex h-full flex-col gap-3">
      {/* Header */}
      <div className={`flex items-center gap-2 rounded-xl border px-3 py-2 ${card}`}>
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
        <span className={`text-xs font-medium ${isDark ? "text-slate-300" : "text-slate-700"}`}>
          Estadísticas
        </span>
        <span className={`ml-auto font-mono text-[10px] ${isDark ? "text-slate-600" : "text-slate-400"}`}>
          t={syncTime.toFixed(1)}s
        </span>
      </div>

      {/* Product count */}
      {(() => {
        // Live count: unique track_ids seen up to currentFrame, scaled to realCount.
        // Falls back to realCount (>0 only) when video is at frame 0 or detections lack track_id.
        // realCount=0 means DB stored a sentinel 0 (old cache) — treat as unknown.
        const displayCount = (liveCount != null && liveCount > 0) ? liveCount : (realCount || null);
        const isLive = liveCount != null && liveCount > 0 && liveCount !== realCount;
        const isComplete = liveCount != null && realCount != null && realCount > 0 && liveCount >= realCount;
        const pct = realCount != null && realCount > 0 && displayCount != null
          ? Math.min(100, Math.round((displayCount / realCount) * 100))
          : null;
        return (
          <div className={`rounded-xl border p-4 ${card}`}>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <CheckCircle2 className={`h-4 w-4 ${(displayCount ?? 0) > 0 ? "text-emerald-400" : "text-slate-500"}`} />
                <span className={`text-xs font-medium ${isDark ? "text-slate-400" : "text-slate-600"}`}>
                  Productos contados
                </span>
              </div>
              {isLive && realCount != null && (
                <span className={`font-mono text-[10px] ${isDark ? "text-slate-600" : "text-slate-400"}`}>
                  / {realCount} total
                </span>
              )}
            </div>
            {displayCount != null ? (
              <>
                <p className="mt-2 font-mono text-3xl font-bold text-emerald-400 tabular-nums">
                  {displayCount.toLocaleString("es-CO")}
                </p>
                {pct != null && isLive && (
                  <div className={`mt-2 h-1 w-full overflow-hidden rounded-full ${isDark ? "bg-slate-800" : "bg-slate-200"}`}>
                    <div
                      className="h-full rounded-full bg-emerald-500 transition-all duration-300"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                )}
                <p className={`mt-1 text-[10px] ${isDark ? "text-slate-600" : "text-slate-400"}`}>
                  {isComplete ? "Conteo completado ✓" : isLive ? "Contando en tiempo real..." : "Total final · ByteTrack"}
                </p>
              </>
            ) : (
              <p className={`mt-2 font-mono text-sm ${isDark ? "text-slate-600" : "text-slate-400"}`}>
                {hasProcessed ? "Cargando..." : "Procesa el video"}
              </p>
            )}
          </div>
        );
      })()}

      {/* KPI grid */}
      {summary && (
        <div className="grid grid-cols-2 gap-2">
          {[
            { icon: PackageCheck, label: "Confianza", value: `${Math.round(summary.avg_confidence * 100)}%`, color: "text-blue-400" },
            { icon: Target, label: "Cobertura", value: coveragePct !== null ? `${coveragePct}%` : "N/D", color: "text-emerald-400" },
            { icon: Layers, label: "Clases", value: summary.unique_classes, color: "text-amber-400" },
            { icon: BarChart2, label: "Detecciones", value: summary.total_detections.toLocaleString("es-CO"), color: "text-slate-500" },
          ].map(({ icon: Icon, label, value, color }) => (
            <div key={label} className={`rounded-xl border p-3 ${card}`}>
              <Icon className={`h-3.5 w-3.5 ${color}`} />
              <p className="mt-1.5 font-mono text-lg font-semibold">{value}</p>
              <p className={`text-[10px] ${isDark ? "text-muted" : "text-slate-500"}`}>{label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Activity timeline — Recharts AreaChart */}
      {timelineData.length > 0 && (
        <div className={`rounded-xl border p-3 ${card}`}>
          <p className={`mb-2 text-[10px] font-medium ${isDark ? "text-slate-500" : "text-slate-500"}`}>
            Actividad · frame #{currentFrame}
          </p>
          <ResponsiveContainer height={72} width="100%">
            <AreaChart data={timelineData} margin={{ top: 2, right: 0, left: -28, bottom: 0 }}>
              <defs>
                <linearGradient id="actGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366F1" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#6366F1" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="bucket" hide />
              <YAxis tick={{ fontSize: 9, fill: "#64748B" }} />
              <Tooltip
                contentStyle={tooltipStyle}
                cursor={{ stroke: isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.1)", strokeWidth: 1 }}
                formatter={(v: number) => [v, "detecciones"]}
                labelFormatter={() => ""}
              />
              <Area
                dataKey="count"
                dot={false}
                fill="url(#actGrad)"
                isAnimationActive={false}
                stroke="#6366F1"
                strokeWidth={1.5}
                type="monotone"
              />
              <ReferenceLine
                stroke="#3B82F6"
                strokeDasharray="3 3"
                strokeWidth={1.5}
                x={currentBucket}
              />
            </AreaChart>
          </ResponsiveContainer>
          <div className={`mt-1 flex justify-between font-mono text-[9px] ${isDark ? "text-slate-700" : "text-slate-400"}`}>
            <span>inicio</span>
            <span>fin</span>
          </div>
        </div>
      )}

      {/* Class distribution */}
      {classDist && classDist.length > 0 && (
        <div className={`rounded-xl border p-3 ${card}`}>
          <p className={`mb-2.5 text-[10px] font-medium ${isDark ? "text-slate-500" : "text-slate-500"}`}>
            Distribución por clase
          </p>
          <div className="space-y-2.5">
            {classDist.slice(0, 5).map((item, idx) => (
              <div key={item.class}>
                <div className="mb-1 flex items-center justify-between gap-1">
                  <span
                    className="max-w-[6rem] truncate rounded-full px-2 py-0.5 text-[10px] font-medium"
                    style={{
                      background: `${CLASS_COLORS[idx % CLASS_COLORS.length]}22`,
                      color: CLASS_COLORS[idx % CLASS_COLORS.length],
                    }}
                  >
                    {item.class}
                  </span>
                  <span className={`font-mono text-[10px] ${isDark ? "text-slate-400" : "text-slate-600"}`}>
                    {item.count.toLocaleString("es-CO")} ({item.percentage.toFixed(0)}%)
                  </span>
                </div>
                <div className={`h-1 overflow-hidden rounded-full ${isDark ? "bg-slate-800" : "bg-slate-200"}`}>
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{ width: `${item.percentage}%`, background: CLASS_COLORS[idx % CLASS_COLORS.length] }}
                  />
                </div>
              </div>
            ))}
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
            {atFrame.slice(0, 6).map((det, i) => {
              const pct = Math.round(det.confidence * 100);
              return (
                <div key={i} className="flex items-center justify-between gap-2">
                  <span className="rounded-md border border-emerald-500/20 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-400">
                    {det.class}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <div className={`h-1 w-10 overflow-hidden rounded-full ${isDark ? "bg-slate-800" : "bg-slate-200"}`}>
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

      {!hasProcessed && (
        <div className={`rounded-xl border px-3 py-4 text-center ${card}`}>
          <p className={`text-xs ${isDark ? "text-slate-600" : "text-slate-400"}`}>
            Procesa el video para ver estadísticas en tiempo real
          </p>
        </div>
      )}
    </div>
  );
}