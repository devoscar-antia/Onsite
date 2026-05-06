"use client";

export function DeleteConfirmModal({
  label,
  isDark,
  loading,
  onCancel,
  onConfirm,
}: {
  label: string;
  isDark: boolean;
  loading: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="modal-fade-in fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm">
      <div
        className={`modal-scale-in w-full max-w-md rounded-2xl border p-5 shadow-2xl ${isDark ? "border-slate-700 bg-[#0D1117] text-slate-100" : "border-slate-200 bg-white text-slate-900"}`}
      >
        <h3 className="text-base font-semibold">Eliminar video</h3>
        <p className={`mt-2 text-sm ${isDark ? "text-slate-400" : "text-slate-600"}`}>
          ¿Seguro que deseas eliminar{" "}
          <span className="font-medium">{label}</span>? Esta acción no se puede
          deshacer.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            className={`rounded-xl border px-4 py-2 text-sm ${isDark ? "border-slate-700 text-slate-300 hover:bg-white/5" : "border-slate-300 text-slate-700 hover:bg-slate-100"}`}
            onClick={onCancel}
            type="button"
          >
            Cancelar
          </button>
          <button
            className="rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-60"
            disabled={loading}
            onClick={onConfirm}
            type="button"
          >
            {loading ? "Eliminando..." : "Sí, eliminar"}
          </button>
        </div>
      </div>
    </div>
  );
}
