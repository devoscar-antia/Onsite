export interface AnalyticsSummary {
  total_detections: number;
  frames_with_detections: number;
  total_frames: number;
  avg_confidence: number;
  unique_classes: number;
  unique_tracked_objects: number;
}

export interface FrameDetection {
  frame: number;
  detections: number;
  classes: string[];
}

export interface ClassDistributionItem {
  class: string;
  count: number;
  percentage: number;
  avg_confidence: number;
  first_frame: number;
}

export interface ConfidencePoint {
  frame: number;
  confidence: number;
}

export interface HeatmapPoint {
  x: number;
  y: number;
  value: number;
}
