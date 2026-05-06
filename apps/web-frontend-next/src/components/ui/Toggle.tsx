"use client";

export function Toggle({
  enabled,
  onChange,
}: {
  enabled: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <button
      className={`relative h-5 w-10 rounded-full transition-all duration-200 ${enabled ? "bg-blue-600" : "bg-slate-700"}`}
      onClick={() => onChange(!enabled)}
      type="button"
    >
      <span
        className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all duration-200 ${enabled ? "left-5" : "left-0.5"}`}
      />
    </button>
  );
}
