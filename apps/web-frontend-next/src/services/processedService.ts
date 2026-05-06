import { apiGet } from "@/lib/api-client";
import type { Detection, ProcessedVideoInfo, VideoMetadata } from "@/types/video";

const vId = (id: string) => encodeURIComponent(id);

export const processedService = {
  getProcessedVideo: (videoId: string) =>
    apiGet<ProcessedVideoInfo>(`/videos/${vId(videoId)}/processed`),

  getProcessedMetadata: (videoId: string) =>
    apiGet<VideoMetadata>(`/videos/${vId(videoId)}/processed/metadata`),

  getDetections: (videoId: string) =>
    apiGet<Detection[]>(`/videos/${vId(videoId)}/detections`),

  getProcessedStreamUrl: (videoId: string) =>
    `/api/proxy/videos/${vId(videoId)}/processed/stream`,

  getDownloadUrl: (videoId: string) =>
    `/api/proxy/videos/${vId(videoId)}/processed/download`,
};
