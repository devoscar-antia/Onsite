"use client";

import { useNameMapStore } from "@/store/videoStore";
import type { VideoItem } from "@/types/video";
import { analyticsService } from "@/services/analyticsService";
import { queryKeys } from "@/lib/query-keys";
import { useQueries } from "@tanstack/react-query";
import {
  BarChart2,
  CheckCircle2,
  Clock,
  Database,
  FileVideo,
  Loader2,
  Package,
  ScanSearch,
  Shield,
  TrendingUp,
  Trophy,
} from "lucide-react";
import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

// ─── helpers ─────────────────────────────────────────────────────────────────

function fmtDuration(s: number) {
  if (!s || !Number.isFinite(s)) return "—";
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}

function fmtBytes(b?: number) {
  if (!b || b <= 0) return "—";
  if (b >= 1_073_741_824) return `${(b / 1_073_741_824).toFixed(1)} GB`;
  if (b >= 1_048_576) return `${(b / 1_048_576).toFixed(1)} MB`;
  return `${Math.round(b / 1024)} KB`;
}

function fmtDate(iso: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-CO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function buildActivity(videos: VideoItem[]) {
  const map: Record<string, { date: string; subidos: number; analizados: number }> = {};
  for (const v of [...videos].sort(
    (a, b) => new Date(a.uploaded_at).getTime() - new Date(b.uploaded_at).getTime(),
  )) {
    const key = new Date(v.uploaded_at).toLocaleDateString("es-CO", {
      day: "2-digit",
      month: "short",
    });
    if (!map[key]) map[key] = { date: key, subidos: 0, analizados: 0 };
    map[key].subidos++;
    if (v.has_processed) map[key].analizados++;
  }
  return Object.values(map).slice(-14);
}

// ─── sub-components ───────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  sub,
  icon: Icon,
  accent,
  isDark,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ElementType;
  accent: string;
  isDark: boolean;
}) {
  return (
    <div className={`rounded-2xl border p-4 ${isDark ? "border-[rgba(255,255,255,0.06)] bg-surface" : "border-slate-200 bg-white"}`}>
      <div className="flex items-start justify-between">
        <p className={`text-xs font-medium ${isDark ? "text-muted" : "text-slate-500"}`}>{label}</p>
        <span className={`rounded-lg p-1.5 ${accent}`}><Icon className="h-3.5 w-3.5" /></span>
      </div>
      <p className="mt-2 font-mono text-xl font-semibold">{String(value)}</p>
      {sub && <p className={`mt-0.5 text-[11px] ${isDark ? "text-slate-600" : "text-slate-400"}`}>{sub}</p>}
    </div>
  );
}

// ─── global detection metrics ─────────────────────────────────────────────────

function GlobalDetectionSection({
  processedVideos,
  nameMap,
  isDark,
}: {
  processedVideos: VideoItem[];
  nameMap: Record<string, string>;
  isDark: boolean;
}) {
  const shortLabel = (v: VideoItem) => {
    const n = nameMap[v.id] ?? v.filename;
    // Short label for X-axis ticks
    return n.replace(/\.[^.]+$/, "").slice(0, 10);
  };

  const targets = processedVideos.slice(0, 20);

  const summaryQueries = useQueries({
    queries: targets.map((v) => ({
      queryKey: queryKeys.analytics.summary(v.id),
      queryFn: () => analyticsService.getSummary(v.id),
      staleTime: 60_000,
    })),
  });

  const loading = summaryQueries.some((q) => q.isLoading);

  const perVideo = useMemo(() => {
    return targets
      .map((v, i) => {
        const s = summaryQueries[i]?.data;
        if (!s) return null;
        const tracked = s.unique_tracked_objects ?? 0;
        const durMin = (v.duration ?? 0) / 60;
        const throughput = durMin > 0 ? Math.round((tracked / durMin) * 10) / 10 : null;
        return {
          name: shortLabel(v),
          fullName: nameMap[v.id] ?? v.filename,
          tracked,
          confidence: Math.round(s.avg_confidence * 100),
          throughput,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)
      .sort((a, b) => b.tracked - a.tracked);
  }, [summaryQueries, targets]);

  const agg = useMemo(() => {
    if (perVideo.length === 0) return null;
    const totalTracked = perVideo.reduce((s, v) => s + v.tracked, 0);
    const avgConf = perVideo.reduce((s, v) => s + v.confidence, 0) / perVideo.length;
    const withThroughput = perVideo.filter((v) => v.throughput !== null);
    const avgThroughput = withThroughput.length
      ? withThroughput.reduce((s, v) => s + (v.throughput ?? 0), 0) / withThroughput.length
      : null;
    const best = perVideo[0];
    return { totalTracked, avgConf, avgThroughput, best };
  }, [perVideo]);

  const cardBase = isDark ? "border-[rgba(255,255,255,0.06)] bg-surface" : "border-slate-200 bg-white";
  const tooltipStyle = {
    background: isDark ? "#0D1117" : "#ffffff",
    border: isDark ? "1px solid rgba(255,255,255,0.1)" : "1px solid #e2e8f0",
    borderRadius: 10,
    fontSize: 12,
  };

  if (loading) {
    return (
      <div className={`flex h-24 items-center justify-center gap-2 rounded-2xl border ${cardBase}`}>
        <Loader2 className="h-4 w-4 animate-spin text-blue-400" />
        <span className={`text-sm ${isDark ? "text-muted" : "text-slate-500"}`}>Cargando métricas...</span>
      </div>
    );
  }

  if (!agg || perVideo.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Package className="h-4 w-4 text-blue-400" />
        <h2 className="text-sm font-semibold">Producción analizada</h2>
        <span className={`text-[10px] ${isDark ? "text-slate-600" : "text-slate-400"}`}>
          · {targets.length} video{targets.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* 3 KPIs + charts in one row */}
      <div className="grid gap-3 lg:grid-cols-5">
        {/* KPI column */}
        <div className="flex flex-col gap-3 lg:col-span-2">
          <div className={`flex-1 rounded-2xl border p-4 ${cardBase}`}>
            <div className="flex items-start justify-between">
              <p className={`text-xs font-medium ${isDark ? "text-muted" : "text-slate-500"}`}>Productos rastreados</p>
              <span className={`rounded-lg p-1.5 ${isDark ? "bg-blue-500/10 text-blue-400" : "bg-blue-50 text-blue-600"}`}>
                <Package className="h-3.5 w-3.5" />
              </span>
            </div>
            <p className="mt-2 font-mono text-2xl font-semibold">{agg.totalTracked.toLocaleString("es-CO")}</p>
            <p className={`mt-0.5 text-[11px] ${isDark ? "text-slate-600" : "text-slate-400"}`}>suma de todos los videos</p>
          </div>

          <div className={`flex-1 rounded-2xl border p-4 ${cardBase}`}>
            <div className="flex items-start justify-between">
              <p className={`text-xs font-medium ${isDark ? "text-muted" : "text-slate-500"}`}>Confianza promedio</p>
              <span className={`rounded-lg p-1.5 ${
                agg.avgConf >= 75 ? isDark ? "bg-emerald-500/10 text-emerald-400" : "bg-emerald-50 text-emerald-600"
                : agg.avgConf >= 50 ? isDark ? "bg-amber-500/10 text-amber-400" : "bg-amber-50 text-amber-600"
                : isDark ? "bg-red-500/10 text-red-400" : "bg-red-50 text-red-600"
              }`}>
                <Shield className="h-3.5 w-3.5" />
              </span>
            </div>
            <p className="mt-2 font-mono text-2xl font-semibold">{agg.avgConf.toFixed(1)}%</p>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-700/30">
              <div
                className={`h-full rounded-full ${agg.avgConf >= 75 ? "bg-emerald-400" : agg.avgConf >= 50 ? "bg-amber-400" : "bg-red-400"}`}
                style={{ width: `${agg.avgConf}%` }}
              />
            </div>
          </div>

          <div className={`flex-1 rounded-2xl border p-4 ${cardBase}`}>
            <div className="flex items-start justify-between">
              <p className={`text-xs font-medium ${isDark ? "text-muted" : "text-slate-500"}`}>
                {agg.avgThroughput !== null ? "Tasa promedio" : "Video top"}
              </p>
              <span className={`rounded-lg p-1.5 ${isDark ? "bg-amber-500/10 text-amber-400" : "bg-amber-50 text-amber-600"}`}>
                <Trophy className="h-3.5 w-3.5" />
              </span>
            </div>
            {agg.avgThroughput !== null ? (
              <>
                <p className="mt-2 font-mono text-2xl font-semibold">
                  {agg.avgThroughput.toFixed(1)}
                  <span className="ml-1 text-sm font-normal text-muted">prod/min</span>
                </p>
                <p className={`mt-0.5 text-[11px] ${isDark ? "text-slate-600" : "text-slate-400"}`}>promedio entre videos</p>
              </>
            ) : (
              <>
                <p className="mt-2 truncate font-mono text-sm font-semibold" title={agg.best.fullName}>{agg.best.name}</p>
                <p className={`mt-0.5 text-[11px] ${isDark ? "text-slate-600" : "text-slate-400"}`}>{agg.best.tracked} productos rastreados</p>
              </>
            )}
          </div>
        </div>

        {/* Leaderboard */}
        <div className={`flex flex-col rounded-2xl border p-4 lg:col-span-3 ${cardBase}`}>
          <div className="mb-1 flex items-center justify-between">
            <p className="text-sm font-semibold">Ranking de producción</p>
            <span className={`text-[10px] ${isDark ? "text-slate-600" : "text-slate-400"}`}>
              por productos rastreados
            </span>
          </div>
          {/* Header */}
          <div className={`mb-2 grid grid-cols-[1.5rem_1fr_auto_auto_auto] items-center gap-3 border-b px-3 pb-2 text-[10px] font-medium uppercase tracking-wider ${isDark ? "border-slate-800 text-slate-600" : "border-slate-200 text-slate-400"}`}>
            <span>#</span>
            <span>Video</span>
            <span className="text-right">Productos</span>
            <span className="text-right">Confianza</span>
            <span className="text-right">Tasa</span>
          </div>
          <div className="flex-1 space-y-1 overflow-y-auto">
            {perVideo.map((v, i) => (
              <div
                key={v.name}
                className={`grid grid-cols-[1.5rem_1fr_auto_auto_auto] items-center gap-3 rounded-xl px-3 py-2.5 transition-colors ${
                  isDark ? "hover:bg-white/[0.04]" : "hover:bg-slate-50"
                } ${i === 0 ? isDark ? "bg-amber-500/5" : "bg-amber-50/60" : ""}`}
              >
                {/* Rank */}
                <span className={`shrink-0 text-center font-mono text-xs font-bold ${
                  i === 0 ? "text-amber-400"
                  : i === 1 ? "text-slate-400"
                  : i === 2 ? "text-orange-500"
                  : isDark ? "text-slate-700" : "text-slate-300"
                }`}>
                  {i + 1}
                </span>
                {/* Name */}
                <span
                  className={`truncate text-xs font-medium ${isDark ? "text-text" : "text-slate-800"}`}
                  title={v.fullName}
                >
                  {v.name}
                </span>
                {/* Tracked */}
                <span className="shrink-0 text-right font-mono text-sm font-bold text-blue-400">
                  {v.tracked}
                </span>
                {/* Confidence badge */}
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-right text-[10px] font-semibold ${
                  v.confidence >= 75
                    ? "bg-emerald-500/10 text-emerald-400"
                    : v.confidence >= 50
                    ? "bg-amber-500/10 text-amber-400"
                    : "bg-red-500/10 text-red-400"
                }`}>
                  {v.confidence}%
                </span>
                {/* Throughput */}
                <span className={`shrink-0 text-right font-mono text-[10px] ${isDark ? "text-slate-500" : "text-slate-400"}`}>
                  {v.throughput !== null ? `${v.throughput} p/m` : "—"}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── main ─────────────────────────────────────────────────────────────────────

export function DashboardTab({
  videos,
  isDark,
  onGoToVideos,
}: {
  videos: VideoItem[];
  isDark: boolean;
  onGoToVideos: () => void;
}) {
  const { nameMap } = useNameMapStore();

  const processedVideos = useMemo(() => videos.filter((v) => v.has_processed), [videos]);
  const recentVideos = useMemo(
    () =>
      [...videos]
        .sort((a, b) => new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime())
        .slice(0, 5),
    [videos],
  );

  const totalSize = useMemo(() => videos.reduce((acc, v) => acc + (v.size ?? 0), 0), [videos]);
  const totalDuration = useMemo(() => videos.reduce((acc, v) => acc + (v.duration ?? 0), 0), [videos]);
  const activityData = useMemo(() => buildActivity(videos), [videos]);

  const cardBase = isDark ? "border-[rgba(255,255,255,0.06)] bg-surface" : "border-slate-200 bg-white";
  const tooltipStyle = {
    background: isDark ? "#0D1117" : "#ffffff",
    border: isDark ? "1px solid rgba(255,255,255,0.1)" : "1px solid #e2e8f0",
    borderRadius: 10,
    fontSize: 12,
  };

  if (videos.length === 0) {
    return (
      <div className={`flex min-h-96 flex-col items-center justify-center gap-4 rounded-2xl border p-8 text-center ${isDark ? "border-border-soft bg-surface" : "border-slate-200 bg-white"}`}>
        <div className={`flex h-16 w-16 items-center justify-center rounded-2xl ${isDark ? "bg-white/5" : "bg-slate-100"}`}>
          <BarChart2 className="h-8 w-8 text-slate-500" />
        </div>
        <div>
          <h3 className="text-base font-semibold">Sin datos todavía</h3>
          <p className={`mt-1 text-sm ${isDark ? "text-muted" : "text-slate-600"}`}>
            Sube y procesa un video para ver las métricas aquí.
          </p>
        </div>
        <button
          className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-500"
          onClick={onGoToVideos}
          type="button"
        >
          <ScanSearch className="h-4 w-4" />
          Ir a Videos
        </button>
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 space-y-3 overflow-y-auto pb-4 pr-1">

      {/* ── KPI cards ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard
          accent={isDark ? "bg-blue-500/10 text-blue-400" : "bg-blue-50 text-blue-600"}
          icon={FileVideo}
          isDark={isDark}
          label="Videos subidos"
          sub={`${processedVideos.length} analizados`}
          value={videos.length}
        />
        <KpiCard
          accent={isDark ? "bg-emerald-500/10 text-emerald-400" : "bg-emerald-50 text-emerald-600"}
          icon={CheckCircle2}
          isDark={isDark}
          label="Videos analizados"
          sub={`${videos.length - processedVideos.length} pendientes`}
          value={processedVideos.length}
        />
        <KpiCard
          accent={isDark ? "bg-purple-500/10 text-purple-400" : "bg-purple-50 text-purple-600"}
          icon={Database}
          isDark={isDark}
          label="Almacenamiento"
          sub="archivos originales"
          value={fmtBytes(totalSize)}
        />
        <KpiCard
          accent={isDark ? "bg-amber-500/10 text-amber-400" : "bg-amber-50 text-amber-600"}
          icon={Clock}
          isDark={isDark}
          label="Duración total"
          sub="suma de videos"
          value={fmtDuration(totalDuration)}
        />
      </div>

      {/* ── Activity + Recent videos ───────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-5">
        <div className={`rounded-2xl border p-4 lg:col-span-3 ${cardBase}`}>
          <div className="mb-3 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-blue-400" />
            <p className="text-sm font-semibold">Actividad de uploads</p>
            <span className={`ml-auto text-[10px] ${isDark ? "text-slate-600" : "text-slate-400"}`}>
              Últimos 14 días
            </span>
          </div>
          {activityData.length === 0 ? (
            <div className={`flex h-36 items-center justify-center text-xs ${isDark ? "text-muted" : "text-slate-400"}`}>
              Sin actividad registrada
            </div>
          ) : (
            <>
              <ResponsiveContainer height={160} width="100%">
                <BarChart data={activityData} barGap={2} barSize={14}>
                  <CartesianGrid
                    stroke={isDark ? "rgba(255,255,255,0.07)" : "rgba(15,23,42,0.1)"}
                    strokeDasharray="3 3"
                    vertical={false}
                  />
                  <XAxis dataKey="date" stroke="#64748B" tick={{ fontSize: 10 }} />
                  <YAxis allowDecimals={false} stroke="#64748B" tick={{ fontSize: 10 }} width={22} />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    cursor={{ fill: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)" }}
                  />
                  <Bar dataKey="subidos" fill="#3B82F6" name="Subidos" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="analizados" fill="#6EE7B7" name="Analizados" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
              <div className="mt-2 flex items-center gap-4">
                <span className="inline-flex items-center gap-1.5 text-[11px] text-slate-500">
                  <span className="h-2 w-2 rounded-full bg-blue-500" />Subidos
                </span>
                <span className="inline-flex items-center gap-1.5 text-[11px] text-slate-500">
                  <span className="h-2 w-2 rounded-full bg-emerald-400" />Analizados
                </span>
              </div>
            </>
          )}
        </div>

        <div className={`rounded-2xl border p-4 lg:col-span-2 ${cardBase}`}>
          <div className="mb-3 flex items-center gap-2">
            <FileVideo className="h-4 w-4 text-blue-400" />
            <p className="text-sm font-semibold">Videos recientes</p>
          </div>
          <div className="space-y-1.5">
            {recentVideos.map((v) => (
              <div
                key={v.id}
                className={`flex items-center gap-3 rounded-xl p-2 transition-colors ${
                  isDark ? "bg-white/2 hover:bg-white/4" : "bg-slate-50 hover:bg-slate-100"
                }`}
              >
                <div className={`grid h-7 w-7 shrink-0 place-content-center rounded-lg ${
                  v.has_processed
                    ? isDark ? "bg-emerald-500/10 text-emerald-400" : "bg-emerald-50 text-emerald-600"
                    : isDark ? "bg-slate-800 text-slate-500" : "bg-slate-200 text-slate-500"
                }`}>
                  {v.has_processed
                    ? <CheckCircle2 className="h-3.5 w-3.5" />
                    : <FileVideo className="h-3.5 w-3.5" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className={`truncate text-xs font-medium ${isDark ? "text-text" : "text-slate-900"}`} title={nameMap[v.id] ?? v.filename}>
                    {nameMap[v.id] ?? v.filename}
                  </p>
                  <p className={`text-[10px] ${isDark ? "text-muted" : "text-slate-500"}`}>
                    {fmtDate(v.uploaded_at)} · {fmtDuration(v.duration)} · {fmtBytes(v.size)}
                  </p>
                </div>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-medium ${
                  v.has_processed
                    ? "bg-emerald-400/10 text-emerald-400"
                    : isDark ? "bg-slate-700 text-slate-400" : "bg-slate-200 text-slate-500"
                }`}>
                  {v.has_processed ? "Analizado" : "Pendiente"}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Production metrics ─────────────────────────────────────────── */}
      {processedVideos.length > 0 && (
        <GlobalDetectionSection
          isDark={isDark}
          nameMap={nameMap}
          processedVideos={processedVideos}
        />
      )}
    </div>
  );
}
