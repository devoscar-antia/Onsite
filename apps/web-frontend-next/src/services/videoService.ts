import { apiDelete, apiGet, apiPost } from "@/lib/api-client";

function readCsrfToken(): string {
  const match = document.cookie.match(/(?:^|; )csrf_token=([^;]*)/);
  return match ? decodeURIComponent(match[1]!) : "";
}
import type { Detection, Job, ProcessResult, UploadResult, VideoItem, VideoMetadata } from "@/types/video";

const vId = (id: string) => encodeURIComponent(id);

export const videoService = {
  getVideos: () => apiGet<VideoItem[]>("/videos"),

  getVideoMetadata: (id: string) =>
    apiGet<VideoMetadata>(`/videos/${vId(id)}/metadata`),

  deleteVideo: (id: string) => apiDelete(`/videos/${vId(id)}`),

  processVideo: (videoFilename: string) =>
    apiPost<ProcessResult>("/videos/process", {
      video_filename: videoFilename,
      model_key: "conveyor-products",
    }),

  getJobs: (videoId: string) =>
    apiGet<Job[]>(`/videos/${vId(videoId)}/jobs`),

  getDetections: (videoId: string) =>
    apiGet<Detection[]>(`/videos/${vId(videoId)}/detections`),

  // These return URLs — browser fetches with cookies automatically
  getVideoStreamUrl: (id: string) =>
    `/api/proxy/videos/${vId(id)}/stream`,

  getDownloadUrl: (id: string) =>
    `/api/proxy/videos/${vId(id)}/download`,

  uploadVideo: (
    file: File,
    onProgress?: (percent: number) => void,
  ): Promise<UploadResult> =>
    new Promise((resolve, reject) => {
      const formData = new FormData();
      formData.append("file", file);

      const xhr = new XMLHttpRequest();
      xhr.open("POST", "/api/proxy/videos/upload");
      const csrfToken = readCsrfToken();
      if (csrfToken) xhr.setRequestHeader("x-csrf-token", csrfToken);

      xhr.upload.onprogress = (event) => {
        if (!onProgress || !event.lengthComputable) return;
        onProgress(Math.round((event.loaded / event.total) * 100));
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            resolve(JSON.parse(xhr.responseText) as UploadResult);
          } catch {
            reject(new Error("Respuesta inválida del servidor."));
          }
        } else {
          try {
            const parsed = JSON.parse(xhr.responseText) as { detail?: string };
            reject(new Error(parsed.detail ?? "No fue posible cargar el video."));
          } catch {
            reject(new Error("No fue posible cargar el video."));
          }
        }
      };

      xhr.onerror = () => reject(new Error("Error de red al cargar el video."));
      xhr.send(formData);
    }),
};
