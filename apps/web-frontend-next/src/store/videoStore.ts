"use client";

import type { ActiveTab, VideoItem } from "@/types/video";
import { create } from "zustand";
import { persist } from "zustand/middleware";

interface VideoState {
  videos: VideoItem[];
  selectedVideoId: string | null;
  activeTab: ActiveTab;
  setVideos: (videos: VideoItem[]) => void;
  setSelectedVideoId: (id: string | null) => void;
  setActiveTab: (tab: ActiveTab) => void;
}

export const useVideoStore = create<VideoState>()((set) => ({
  videos: [],
  selectedVideoId: null,
  activeTab: "videos",

  setVideos: (videos) =>
    set((state) => {
      const nextSelected =
        videos.length === 0
          ? null
          : state.selectedVideoId && videos.some((v) => v.id === state.selectedVideoId)
            ? state.selectedVideoId
            : (videos[0]?.id ?? null);
      return { videos, selectedVideoId: nextSelected };
    }),

  setSelectedVideoId: (id) => set({ selectedVideoId: id }),
  setActiveTab: (tab) => set({ activeTab: tab }),
}));

interface NameMapState {
  nameMap: Record<string, string>;
  setName: (videoId: string, name: string) => void;
  removeName: (videoId: string) => void;
}

export const useNameMapStore = create<NameMapState>()(
  persist(
    (set) => ({
      nameMap: {},
      setName: (videoId, name) =>
        set((state) => ({ nameMap: { ...state.nameMap, [videoId]: name } })),
      removeName: (videoId) =>
        set((state) => {
          const next = { ...state.nameMap };
          delete next[videoId];
          return { nameMap: next };
        }),
    }),
    { name: "video-name-map", skipHydration: true },
  ),
);
