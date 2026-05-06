import type { ReactNode } from "react";

export function SettingsCard({
  title,
  description,
  children,
  footer,
  isDark = true,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  isDark?: boolean;
}) {
  return (
    <div
      className={`mb-4 overflow-hidden rounded-2xl border ${isDark ? "border-slate-800 bg-white/[0.03]" : "border-slate-200 bg-white"}`}
    >
      <div className={`px-6 py-5 ${isDark ? "border-b border-slate-800" : "border-b border-slate-200"}`}>
        <h3 className={`text-sm font-medium ${isDark ? "text-white" : "text-slate-900"}`}>{title}</h3>
        {description ? (
          <p className={`mt-0.5 text-xs ${isDark ? "text-slate-500" : "text-slate-600"}`}>{description}</p>
        ) : null}
      </div>
      <div className="px-6 py-5">{children}</div>
      {footer ? (
        <div
          className={`flex justify-end px-6 py-4 ${isDark ? "border-t border-slate-800 bg-white/[0.02]" : "border-t border-slate-200 bg-slate-50/70"}`}
        >
          {footer}
        </div>
      ) : null}
    </div>
  );
}
