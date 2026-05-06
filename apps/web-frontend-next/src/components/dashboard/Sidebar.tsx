"use client";

import type { ActiveTab } from "@/types/video";
import { BarChart2, FileVideo, PanelLeftClose, PanelLeftOpen, Settings } from "lucide-react";
import { useTranslations } from "next-intl";

export function Sidebar({
  activeTab,
  isDark,
  collapsed,
  onTabChange,
  onToggleCollapse,
}: {
  activeTab: ActiveTab;
  isDark: boolean;
  collapsed: boolean;
  onTabChange: (tab: ActiveTab) => void;
  onToggleCollapse: () => void;
}) {
  const t = useTranslations("sidebar");
  const NAV = [
    { key: "videos" as ActiveTab, label: t("videos"), icon: FileVideo },
    { key: "dashboard" as ActiveTab, label: t("dashboard"), icon: BarChart2 },
    { key: "settings" as ActiveTab, label: t("settings"), icon: Settings },
  ];
  return (
    <aside
      className={`fixed inset-y-0 left-0 hidden flex-col border-r p-3 md:flex transition-all duration-300 ${
        collapsed ? "w-16" : "w-60"
      } ${isDark ? "border-border-soft bg-surface/95" : "border-slate-200 bg-white/95"}`}
    >
      {/* Logo */}
      <div className={`mb-6 flex items-center ${collapsed ? "justify-center" : ""}`}>
        <div className="grid h-9 w-9 shrink-0 place-content-center rounded-xl bg-linear-to-br from-blue-600 to-blue-400 text-sm font-semibold text-white">
          ON
        </div>
        {!collapsed && (
          <div className="ml-3 min-w-0">
            <p className="text-sm font-semibold leading-tight">Onsite</p>
            <p className="text-[10px] text-muted">Enterprise Analytics</p>
          </div>
        )}
      </div>

      {/* Nav items */}
      <nav className="flex flex-1 flex-col gap-1">
        {NAV.map(({ key, label, icon: Icon }) => {
          const isActive = activeTab === key;
          return (
            <button
              className={`flex w-full items-center gap-3 rounded-xl px-2.5 py-2.5 text-sm transition-all ${
                collapsed ? "justify-center" : ""
              } ${
                isActive
                  ? "border-l-2 border-primary bg-blue-500/10 text-blue-500"
                  : isDark
                    ? "text-muted hover:bg-white/5 hover:text-text"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              }`}
              key={key}
              onClick={() => onTabChange(key)}
              title={collapsed ? label : undefined}
              type="button"
            >
              <Icon className="h-4 w-4 shrink-0" />
              {!collapsed && <span>{label}</span>}
            </button>
          );
        })}
      </nav>

      {/* Collapse / expand toggle — always at bottom */}
      <button
        aria-label={collapsed ? "Expandir menú" : "Minimizar menú"}
        className={`mt-2 flex w-full items-center gap-3 rounded-xl px-2.5 py-2.5 text-sm transition-colors ${
          collapsed ? "justify-center" : ""
        } ${isDark ? "text-muted hover:bg-white/5 hover:text-text" : "text-slate-500 hover:bg-slate-100 hover:text-slate-700"}`}
        onClick={onToggleCollapse}
        title={collapsed ? "Expandir menú" : undefined}
        type="button"
      >
        {collapsed
          ? <PanelLeftOpen className="h-4 w-4 shrink-0" />
          : <><PanelLeftClose className="h-4 w-4 shrink-0" /><span>Minimizar menú</span></>
        }
      </button>
    </aside>
  );
}
