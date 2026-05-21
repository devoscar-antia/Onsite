"use client";

import { useVideoUpload } from "@/hooks/useVideoUpload";
import type { VideoItem } from "@/types/video";
import { Upload, X } from "lucide-react";
import { useCallback, useRef, useState } from "react";

const ACCEPT = ["video/mp4", "video/quicktime", "video/x-msvideo", "video/x-matroska"];
const ACCEPT_EXT = ".mp4,.mov,.avi,.mkv";

export function UploadDropzone({
  isDark,
  onSuccess,
}: {
  isDark: boolean;
  onSuccess: (video: VideoItem, originalName: string) => void;
}) {
  const { upload, uploading, progress } = useVideoUpload(onSuccess);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    async (file: File) => {
      setError(null);
      if (!ACCEPT.includes(file.type) && !file.name.match(/\.(mp4|mov|avi|mkv)$/i)) {
        setError("Formato no soportado. Usa MP4, MOV, AVI o MKV.");
        return;
      }
      await upload(file);
    },
    [upload],
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) void handleFile(file);
    },
    [handleFile],
  );

  const onInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) void handleFile(file);
      e.target.value = "";
    },
    [handleFile],
  );

  if (uploading) {
    return (
      <div className={`rounded-xl border p-4 ${isDark ? "border-border-soft bg-white/2" : "border-slate-200 bg-white"}`}>
        <div className="mb-2 flex items-center justify-between">
          <span className={`text-xs font-medium ${isDark ? "text-slate-300" : "text-slate-700"}`}>
            Subiendo video...
          </span>
          <span className={`font-mono text-xs ${isDark ? "text-slate-500" : "text-slate-400"}`}>
            {progress}%
          </span>
        </div>
        <div className={`h-1.5 w-full overflow-hidden rounded-full ${isDark ? "bg-slate-800" : "bg-slate-200"}`}>
          <div
            className="relative h-full rounded-full bg-blue-500 transition-all duration-300"
            style={{ width: `${progress}%` }}
          >
            <span className="progress-shimmer" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div
        className={`flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed px-3 py-4 transition-all ${
          dragging
            ? isDark
              ? "border-blue-500/60 bg-blue-500/10"
              : "border-blue-400 bg-blue-50"
            : isDark
              ? "border-slate-800 hover:border-slate-700 hover:bg-white/2"
              : "border-slate-300 hover:border-slate-400 hover:bg-slate-50"
        }`}
        onClick={() => inputRef.current?.click()}
        onDragEnter={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={(e) => { e.preventDefault(); setDragging(false); }}
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") inputRef.current?.click(); }}
      >
        <Upload className={`h-5 w-5 ${dragging ? "text-blue-400" : isDark ? "text-slate-600" : "text-slate-400"}`} />
        <div className="text-center">
          <p className={`text-xs font-medium ${isDark ? "text-slate-400" : "text-slate-600"}`}>
            Arrastra un video o{" "}
            <span className="text-blue-400 underline-offset-2 hover:underline">selecciona</span>
          </p>
          <p className={`mt-0.5 text-[10px] ${isDark ? "text-slate-600" : "text-slate-400"}`}>
            MP4, MOV, AVI, MKV
          </p>
        </div>
      </div>

      {error && (
        <div className="mt-2 flex items-start gap-1.5 rounded-lg bg-red-500/10 px-2.5 py-2">
          <span className="mt-0.5 text-[10px] leading-tight text-red-400">{error}</span>
          <button className="ml-auto shrink-0 text-red-400 hover:text-red-300" onClick={() => setError(null)} type="button">
            <X className="h-3 w-3" />
          </button>
        </div>
      )}

      <input
        ref={inputRef}
        accept={ACCEPT_EXT}
        className="hidden"
        onChange={onInputChange}
        type="file"
      />
    </div>
  );
}