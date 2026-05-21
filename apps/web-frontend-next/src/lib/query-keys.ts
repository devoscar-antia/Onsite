export const queryKeys = {
  videos: () => ["videos"] as const,
  video: (videoId: string) => ["videos", videoId] as const,
  videoMetadata: (videoId: string) => ["videos", videoId, "metadata"] as const,
  detections: (videoId: string) => ["videos", videoId, "detections"] as const,
  jobs: (videoId: string) => ["videos", videoId, "jobs"] as const,
  processed: (videoId: string) => ["videos", videoId, "processed"] as const,
  processedMetadata: (videoId: string) =>
    ["videos", videoId, "processed", "metadata"] as const,
  analytics: {
    all: (videoId: string) => ["videos", videoId, "analytics"] as const,
    summary: (videoId: string) =>
      ["videos", videoId, "analytics", "summary"] as const,
    byFrame: (videoId: string) =>
      ["videos", videoId, "analytics", "by-frame"] as const,
    classDistribution: (videoId: string) =>
      ["videos", videoId, "analytics", "class-distribution"] as const,
    confidenceTimeline: (videoId: string) =>
      ["videos", videoId, "analytics", "confidence-timeline"] as const,
    heatmap: (videoId: string) =>
      ["videos", videoId, "analytics", "heatmap"] as const,
  },
  productCount: (videoId: string) =>
    ["videos", videoId, "product-count"] as const,
  productCounts: () => ["product-counts"] as const,
  me: () => ["me"] as const,
  preferences: () => ["preferences"] as const,
  sessions: () => ["sessions"] as const,
  adminUsers: () => ["admin", "users"] as const,
  adminStats: () => ["admin", "stats"] as const,
} as const;
