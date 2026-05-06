import { apiGet } from "@/lib/api-client";
import type {
  AnalyticsSummary,
  ClassDistributionItem,
  ConfidencePoint,
  FrameDetection,
  HeatmapPoint,
} from "@/types/analytics";

const vId = (id: string) => encodeURIComponent(id);

export const analyticsService = {
  getSummary: (videoId: string) =>
    apiGet<AnalyticsSummary>(`/videos/${vId(videoId)}/analytics/summary`),

  getDetectionsByFrame: (videoId: string) =>
    apiGet<FrameDetection[]>(`/videos/${vId(videoId)}/analytics/by-frame`),

  getClassDistribution: (videoId: string) =>
    apiGet<ClassDistributionItem[]>(
      `/videos/${vId(videoId)}/analytics/class-distribution`,
    ),

  getConfidenceOverTime: (videoId: string) =>
    apiGet<ConfidencePoint[]>(
      `/videos/${vId(videoId)}/analytics/confidence-timeline`,
    ),

  getHeatmapData: (videoId: string) =>
    apiGet<HeatmapPoint[]>(`/videos/${vId(videoId)}/analytics/heatmap`),
};
