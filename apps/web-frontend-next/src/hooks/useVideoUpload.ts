"use client";

import { videoService } from "@/services/videoService";
import type { VideoItem } from "@/types/video";
import { useCallback, useState } from "react";

export function useVideoUpload(
  onSuccess: (video: VideoItem, originalName: string) => void,
) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const upload = useCallback(
    async (file: File) => {
      setUploading(true);
      setProgress(0);
      try {
        const result = await videoService.uploadVideo(file, setProgress);
        const originalName = result.original_name || file.name || result.filename;
        const optimistic: VideoItem = {
          id: result.filename,
          filename: originalName,
          uploaded_at: new Date().toISOString(),
          duration: 0,
          has_processed: false,
          thumbnail_url: null,
        };
        setProgress(100);
        onSuccess(optimistic, originalName);
      } catch (error) {
        const msg =
          error instanceof Error
            ? error.message
            : "No fue posible cargar el video.";
        window.alert(msg);
      } finally {
        setUploading(false);
        window.setTimeout(() => setProgress(0), 600);
      }
    },
    [onSuccess],
  );

  return { upload, uploading, progress };
}
