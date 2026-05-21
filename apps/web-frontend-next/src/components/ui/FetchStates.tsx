import type { LucideIcon } from "lucide-react";

export function LoadingSkeleton({
  className = "",
  isDark = true,
}: {
  className?: string;
  isDark?: boolean;
}) {
  return (
    <div
      className={`animate-pulse rounded-2xl ${isDark ? "bg-surface" : "bg-slate-200"} ${className}`}
    />
  );
}

export function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="grid min-h-50 place-items-center rounded-2xl border border-danger/20 bg-danger/5 p-6">
      <div className="text-center">
        <p className="text-sm font-medium text-danger">{message}</p>
        {onRetry && (
          <button
            className="mt-3 rounded-xl border border-danger/20 px-4 py-2 text-sm text-danger hover:bg-danger/10"
            onClick={onRetry}
            type="button"
          >
            Reintentar
          </button>
        )}
      </div>
    </div>
  );
}

export function EmptyState({
  title,
  description,
  icon: Icon,
  isDark = true,
}: {
  title: string;
  description: string;
  icon: LucideIcon;
  isDark?: boolean;
}) {
  return (
    <div
      className={`grid min-h-70 place-items-center rounded-2xl border p-6 ${isDark ? "border-border-soft bg-surface" : "border-slate-200 bg-white"}`}
    >
      <div className="text-center">
        <Icon
          className={`mx-auto h-12 w-12 ${isDark ? "text-muted" : "text-slate-400"}`}
        />
        <h3 className="mt-3 text-base font-semibold">{title}</h3>
        <p className={`mt-1 text-sm ${isDark ? "text-muted" : "text-slate-600"}`}>
          {description}
        </p>
      </div>
    </div>
  );
}
