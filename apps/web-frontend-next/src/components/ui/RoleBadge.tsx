const roleConfig: Record<string, { label: string; bg: string; text: string; border: string }> = {
  admin: { label: "Admin", bg: "bg-amber-500/10", text: "text-amber-400", border: "border-amber-500/20" },
  analyst: { label: "Analista", bg: "bg-blue-500/10", text: "text-blue-400", border: "border-blue-500/20" },
  supervisor: { label: "Supervisor", bg: "bg-purple-500/10", text: "text-purple-400", border: "border-purple-500/20" },
  engineer: { label: "Ingeniero", bg: "bg-teal-500/10", text: "text-teal-400", border: "border-teal-500/20" },
  viewer: { label: "Visualizador", bg: "bg-slate-500/10", text: "text-slate-400", border: "border-slate-500/20" },
};

export function RoleBadge({ role }: { role: string }) {
  const cfg = roleConfig[role] ?? roleConfig.viewer!;
  return (
    <span
      className={`inline-flex items-center rounded-md border px-2 py-1 text-xs font-medium ${cfg.bg} ${cfg.text} ${cfg.border}`}
    >
      {cfg.label}
    </span>
  );
}
