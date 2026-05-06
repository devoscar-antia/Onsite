export interface VideoItem {
  id: string;
  filename: string;
  uploaded_at: string;
  duration: number;
  size?: number;
  has_processed: boolean;
  thumbnail_url?: string | null;
}

export interface VideoMetadata {
  duration: number;
  size: number;
  format: string;
  width?: number;
  height?: number;
  fps?: number;
}

export interface Detection {
  frame: number;
  class: string;
  confidence: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface ProcessedVideoInfo {
  status: string;
  processed_filename: string;
  processed_video_url: string;
}

export interface ProcessResult {
  processed_filename: string;
  processed_video_url: string;
  summary: {
    model: string;
    total_count: number;
    status: string;
  };
}

export interface UploadResult {
  filename: string;
  original_name: string;
  video_url: string;
}

export interface Job {
  id: string;
  video_id: string;
  status: "pending" | "processing" | "done" | "error";
  progress?: number;
  total_count?: number;
  created_at: string;
  updated_at?: string;
}

export type ActiveTab = "videos" | "dashboard" | "settings";
