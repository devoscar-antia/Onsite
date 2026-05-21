"use client";

import { useAuth } from "@/hooks/useAuth";
import type { ActiveTab } from "@/types/video";
import { AlertCircle, Bell, CheckCircle2, LogOut, Moon, SlidersHorizontal, Sun, Upload } from "lucide-react";
import { useState } from "react";

type NotifType = "upload" | "processed" | "error";

type Notification = {
  id: string;
  type: NotifType;
  title: string;
  message: string;
  time: string;
  read: boolean;
};

function NotifIcon({ type }: { type: NotifType }) {
  if (type === "upload") return <Upload className="h-3.5 w-3.5 text-blue-400" />;
  if (type === "error") return <AlertCircle className="h-3.5 w-3.5 text-red-400" />;
  return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />;
}

export function DashboardHeader({
  activeTab,
  isDark,
  notifications,
  onMarkAllRead,
  onToggleTheme,
}: {
  activeTab: ActiveTab;
  isDark: boolean;
  notifications: Notification[];
  onMarkAllRead: () => void;
  onToggleTheme: () => void;
}) {
  const logout = useAuth((s) => s.logout);
  const [notifOpen, setNotifOpen] = useState(false);
  const unread = notifications.filter((n) => !n.read).length;

  return (
    <header className="mb-5 flex items-center justify-between gap-4">
      <div>
        <p className="text-xs text-muted">
          Workspace /{" "}
          {{ videos: "Videos", dashboard: "Dashboard", live: "En vivo", settings: "Configuración" }[activeTab]}
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">
          Onsite – Enterprise Video Analytics
        </h1>
      </div>

      <div className="relative flex items-center gap-2">
        <button
          aria-label="Cambiar tema"
          className={`group relative inline-flex h-9 w-[74px] items-center rounded-full border px-1 transition-all ${isDark ? "border-border-soft bg-surface" : "border-slate-200 bg-white"}`}
          onClick={onToggleTheme}
          type="button"
        >
          <SlidersHorizontal className={`ml-1 h-3.5 w-3.5 ${isDark ? "text-slate-400" : "text-slate-500"}`} />
          <span
            className={`absolute top-1 inline-flex h-7 w-7 items-center justify-center rounded-full transition-all duration-300 ${isDark ? "left-[42px] bg-slate-800 text-amber-300" : "left-[20px] bg-slate-200 text-indigo-700"}`}
          >
            {isDark ? <Moon className="h-3.5 w-3.5" /> : <Sun className="h-3.5 w-3.5" />}
          </span>
        </button>

        <button
          className={`relative inline-flex h-9 w-9 items-center justify-center rounded-lg border ${isDark ? "border-border-soft bg-surface text-muted hover:bg-white/5 hover:text-text" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-100"}`}
          onClick={() => {
            setNotifOpen((o) => !o);
            if (!notifOpen) onMarkAllRead();
          }}
          type="button"
        >
          <Bell className="h-4 w-4" />
          {unread > 0 && (
            <span className="absolute -right-1 -top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
              {unread}
            </span>
          )}
        </button>

        {notifOpen && (
          <div
            className={`absolute right-16 top-14 z-20 w-80 rounded-xl border p-2 shadow-lg ${isDark ? "border-border-soft bg-[#0f172a]" : "border-slate-200 bg-white"}`}
          >
            <p className={`px-2 pb-2 pt-1 text-xs font-semibold ${isDark ? "text-slate-300" : "text-slate-700"}`}>
              Notificaciones
            </p>
            <div className="max-h-72 space-y-1 overflow-auto">
              {notifications.length === 0 ? (
                <p className={`rounded-lg px-2 py-3 text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                  Sin notificaciones.
                </p>
              ) : (
                notifications.map((n) => (
                  <div
                    key={n.id}
                    className={`rounded-lg border px-2 py-2 text-xs ${
                      n.type === "error"
                        ? isDark ? "border-red-900/40 bg-red-500/5 text-slate-300" : "border-red-200 bg-red-50 text-slate-700"
                        : isDark ? "border-slate-700 bg-white/[0.02] text-slate-300" : "border-slate-200 bg-slate-50 text-slate-700"
                    }`}
                  >
                    <p className="inline-flex items-center gap-1 font-semibold">
                      <NotifIcon type={n.type} />
                      {n.title}
                    </p>
                    <p className={`mt-1 ${isDark ? "text-slate-400" : "text-slate-600"}`}>
                      {n.message}
                    </p>
                    <p className="mt-1 text-[10px] text-slate-500">{n.time}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        <button
          className={`inline-flex h-9 w-9 items-center justify-center rounded-lg border ${isDark ? "border-red-500/30 bg-red-500/10 text-red-300 hover:bg-red-500/20" : "border-red-200 bg-red-50 text-red-600 hover:bg-red-100"}`}
          onClick={() => void logout()}
          type="button"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}
