"use client";

import LanguageSection, { type LanguageState } from "@/components/settings/LanguageSection";
import { RoleBadge } from "@/components/ui/RoleBadge";
import { SettingsCard } from "@/components/ui/SettingsCard";
import { Toggle } from "@/components/ui/Toggle";
import { useAuth } from "@/hooks/useAuth";
import { adminService } from "@/services/adminService";
import { settingsService } from "@/services/settingsService";
import type { AdminUser } from "@/types/settings";
import type { UserProfile, UserPreferences } from "@/types/settings";
import {
  Activity,
  Bell,
  Camera,
  Check,
  ChevronDown,
  Clock,
  Globe,
  KeyRound,
  LogOut,
  Monitor,
  Palette,
  Search,
  ShieldCheck,
  ShieldOff,
  Smartphone,
  User,
  UserX,
  Users,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// Local types
// ---------------------------------------------------------------------------
interface NotificationSettings {
  video_uploaded: boolean;
  video_processed: boolean;
}

interface AppearanceState {
  theme: string;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------
function SaveButton({
  label = "Guardar cambios",
  onSave,
}: {
  label?: string;
  onSave: () => Promise<void>;
}) {
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  return (
    <button
      className="inline-flex min-w-40 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm text-white transition-all hover:bg-blue-500 disabled:opacity-60"
      disabled={loading}
      onClick={async () => {
        setLoading(true);
        await onSave();
        setLoading(false);
        setDone(true);
        window.setTimeout(() => setDone(false), 1400);
      }}
      type="button"
    >
      {loading ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" /> : null}
      {!loading && done ? <Check className="h-4 w-4" /> : null}
      {loading ? "Guardando..." : done ? "Guardado ✓" : label}
    </button>
  );
}

function FloatingInput({
  label,
  value,
  onChange,
  type = "text",
  isDark = true,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  isDark?: boolean;
}) {
  return (
    <div className="relative">
      <input
        className={`peer w-full rounded-xl border px-4 pb-2 pt-5 text-sm outline-none transition-all placeholder-transparent focus:border-blue-500 ${
          isDark
            ? "border-slate-700 bg-white/5 text-white hover:border-slate-500"
            : "border-slate-300 bg-slate-50 text-slate-900 hover:border-slate-400"
        }`}
        onChange={(e) => onChange(e.target.value)}
        placeholder=" "
        type={type}
        value={value}
      />
      <label
        className={`pointer-events-none absolute left-4 top-1.5 text-xs transition-all peer-placeholder-shown:top-3.5 peer-placeholder-shown:text-sm peer-focus:top-1.5 peer-focus:text-xs peer-focus:text-blue-400 ${
          isDark ? "text-slate-400" : "text-slate-500"
        }`}
      >
        {label}
      </label>
    </div>
  );
}

function ConfirmModal({
  title,
  description,
  confirmWord,
  onConfirm,
  onCancel,
  danger = false,
  isDark = true,
}: {
  title: string;
  description: string;
  confirmWord: string;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
  danger?: boolean;
  isDark?: boolean;
}) {
  const [typed, setTyped] = useState("");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div
        className={`mx-4 w-full max-w-md rounded-2xl border p-6 ${isDark ? "border-slate-700 bg-[#0D1117]" : "border-slate-200 bg-white"}`}
      >
        <h3 className={`text-base font-semibold ${isDark ? "text-white" : "text-slate-900"}`}>{title}</h3>
        <p className={`mt-2 text-sm ${isDark ? "text-slate-400" : "text-slate-600"}`}>{description}</p>
        <input
          className={`mt-4 w-full rounded-xl border px-4 py-3 text-sm outline-none focus:border-blue-500 ${
            isDark ? "border-slate-700 bg-white/5 text-white" : "border-slate-300 bg-slate-50 text-slate-900"
          }`}
          onChange={(e) => setTyped(e.target.value)}
          placeholder={`Escribe ${confirmWord}`}
          value={typed}
        />
        <div className="mt-5 flex gap-3">
          <button
            className={`flex-1 rounded-xl border py-2.5 text-sm ${isDark ? "border-slate-700 text-slate-300 hover:bg-white/5" : "border-slate-300 text-slate-700 hover:bg-slate-100"}`}
            onClick={onCancel}
            type="button"
          >
            Cancelar
          </button>
          <button
            className={`flex-1 rounded-xl py-2.5 text-sm text-white disabled:opacity-50 ${danger ? "bg-red-600 hover:bg-red-500" : "bg-blue-600 hover:bg-blue-500"}`}
            disabled={typed !== confirmWord}
            onClick={onConfirm}
            type="button"
          >
            Confirmar
          </button>
        </div>
      </div>
    </div>
  );
}

function SettingsSidebar({
  activeTab,
  onChange,
  userRole,
  isDark,
}: {
  activeTab: string;
  onChange: (tab: string) => void;
  userRole?: string;
  isDark?: boolean;
}) {
  const t = useTranslations("settings");
  const navItems = [
    { id: "profile", icon: User, label: t("profile") },
    { id: "security", icon: ShieldCheck, label: t("security") },
    { id: "appearance", icon: Palette, label: t("appearance") },
    { id: "language", icon: Globe, label: t("language") },
    { id: "notifications", icon: Bell, label: t("notifications") },
    { id: "users", icon: Users, label: t("users"), adminOnly: true },
  ];
  return (
    <aside
      className={`sticky top-0 w-full shrink-0 self-start rounded-2xl border p-2 lg:w-[220px] ${isDark ? "border-slate-800 bg-white/[0.03]" : "border-slate-200 bg-white"}`}
    >
      {navItems
        .filter((item) => !item.adminOnly || userRole === "admin")
        .map((item, idx, filtered) => {
          const Icon = item.icon;
          const active = activeTab === item.id;
          const previous = filtered[idx - 1];
          return (
            <div key={item.id}>
              {item.adminOnly && previous && !previous.adminOnly ? (
                <div className={`my-2 border-t ${isDark ? "border-slate-800" : "border-slate-200"}`} />
              ) : null}
              <button
                className={`w-full rounded-xl px-3 py-2.5 text-left text-sm transition-all duration-150 ${
                  active ? "bg-blue-500/15 text-blue-400" : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
                }`}
                onClick={() => onChange(item.id)}
                type="button"
              >
                <span className="flex items-center gap-3">
                  <Icon className={`h-4 w-4 shrink-0 ${active ? "text-blue-400" : ""}`} />
                  {item.label}
                  {item.adminOnly ? (
                    <span className="ml-auto rounded-md border border-amber-500/20 bg-amber-500/10 px-1.5 py-0.5 text-xs text-amber-400">
                      Admin
                    </span>
                  ) : null}
                </span>
              </button>
            </div>
          );
        })}
    </aside>
  );
}

const ROLE_OPTIONS = [
  { value: "admin", label: "Admin" },
  { value: "analyst", label: "Analista" },
  { value: "supervisor", label: "Supervisor" },
  { value: "engineer", label: "Ingeniero" },
  { value: "viewer", label: "Visualizador" },
] as const;

function RoleSelector({
  user,
  onChange,
  isDark,
}: {
  user: AdminUser;
  onChange: (id: string | number, role: string) => void;
  isDark: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [dropPos, setDropPos] = useState({ top: 0, left: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);

  const handleOpen = () => {
    if (btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setDropPos({ top: r.bottom + 6, left: r.left });
    }
    setOpen((v) => !v);
  };

  return (
    <div className="inline-flex">
      <button
        ref={btnRef}
        className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium transition-all hover:opacity-80 ${
          {
            admin: "border-amber-500/20 bg-amber-500/10 text-amber-400",
            analyst: "border-blue-500/20 bg-blue-500/10 text-blue-400",
            supervisor: "border-purple-500/20 bg-purple-500/10 text-purple-400",
            engineer: "border-teal-500/20 bg-teal-500/10 text-teal-400",
            viewer: "border-slate-500/20 bg-slate-500/10 text-slate-400",
          }[user.role] ?? "border-slate-500/20 bg-slate-500/10 text-slate-400"
        }`}
        onClick={handleOpen}
        title="Cambiar rol"
        type="button"
      >
        {ROLE_OPTIONS.find((r) => r.value === user.role)?.label ?? user.role}
        <ChevronDown className="h-3 w-3 opacity-60" />
      </button>
      {open ? (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            className={`fixed z-50 w-40 overflow-hidden rounded-xl border shadow-xl ${
              isDark ? "border-slate-700 bg-[#0D1117]" : "border-slate-200 bg-white"
            }`}
            style={{ top: dropPos.top, left: dropPos.left }}
          >
            {ROLE_OPTIONS.map((r) => (
              <button
                className={`flex w-full items-center justify-between px-3 py-2 text-xs transition-colors ${
                  isDark ? "hover:bg-white/5" : "hover:bg-slate-50"
                } ${user.role === r.value ? (isDark ? "text-white" : "text-slate-900") : isDark ? "text-slate-400" : "text-slate-600"}`}
                key={r.value}
                onClick={() => { onChange(user.id, r.value); setOpen(false); }}
                type="button"
              >
                {r.label}
                {user.role === r.value ? <Check className="h-3 w-3 text-blue-400" /> : null}
              </button>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Avatar colors
// ---------------------------------------------------------------------------
const AVATAR_COLORS: { from: string; to: string; label: string }[] = [
  { from: "#2563eb", to: "#60a5fa", label: "Blue" },
  { from: "#7c3aed", to: "#a78bfa", label: "Violet" },
  { from: "#059669", to: "#34d399", label: "Emerald" },
  { from: "#ea580c", to: "#fbbf24", label: "Orange" },
  { from: "#db2777", to: "#f472b6", label: "Pink" },
  { from: "#0891b2", to: "#38bdf8", label: "Cyan" },
  { from: "#d97706", to: "#fde68a", label: "Amber" },
  { from: "#475569", to: "#94a3b8", label: "Slate" },
];

function profileCompleteness(form: { name: string; lastName: string; email: string; phone: string; department: string }) {
  const fields = [form.name, form.lastName, form.email, form.phone, form.department];
  return Math.round((fields.filter(Boolean).length / fields.length) * 100);
}

function ProfileSection({
  me,
  form,
  setForm,
  avatarColorIdx,
  setAvatarColorIdx,
  sessions,
  isDark,
  onSave,
}: {
  me: UserProfile;
  form: { name: string; lastName: string; email: string; phone: string; department: string };
  setForm: React.Dispatch<React.SetStateAction<typeof form>>;
  avatarColorIdx: number;
  setAvatarColorIdx: (i: number) => void;
  sessions: { isCurrent?: boolean; is_current?: boolean; device?: string; ip?: string; lastSeen?: string; last_seen?: string }[];
  isDark: boolean;
  onSave: () => Promise<void>;
}) {
  const [showColorPicker, setShowColorPicker] = useState(false);
  const color = AVATAR_COLORS[avatarColorIdx]!;
  const initials = `${form.name?.[0] ?? "U"}${form.lastName?.[0] ?? ""}`.toUpperCase();
  const pct = profileCompleteness(form);

  const memberDays = me.createdAt
    ? Math.floor((Date.now() - new Date(me.createdAt).getTime()) / 86_400_000)
    : null;

  const lastSession = sessions.find((s) => !(s.isCurrent ?? s.is_current));
  const lastSeenStr = lastSession?.lastSeen ?? lastSession?.last_seen;

  const statItems = [
    { label: "Días activo", value: memberDays != null ? String(memberDays) : "—" },
    { label: "Sesiones", value: String(sessions.length) },
    { label: "Rol", value: me.role },
  ];

  return (
    <>
      {/* Hero card */}
      <div className={`mb-4 overflow-hidden rounded-2xl border ${isDark ? "border-slate-800 bg-surface" : "border-slate-200 bg-white"}`}>
        {/* Banner */}
        <div
          className="h-24 w-full"
          style={{ background: `linear-gradient(135deg, ${color.from}33, ${color.to}22)` }}
        />
        {/* Avatar + info */}
        <div className="flex items-end gap-4 px-6 pb-5">
          <div className="relative -mt-10">
            <div
              className="flex h-20 w-20 items-center justify-center rounded-2xl text-2xl font-bold text-white shadow-lg ring-4 ring-[var(--ring)]"
              style={{
                background: `linear-gradient(135deg, ${color.from}, ${color.to})`,
                ["--ring" as string]: isDark ? "#0d1117" : "#ffffff",
              }}
            >
              {initials}
            </div>
            {/* Color picker toggle */}
            <button
              className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full border-2 bg-slate-800 border-slate-700 text-slate-300 transition-colors hover:bg-slate-700"
              onClick={() => setShowColorPicker((v) => !v)}
              title="Cambiar color"
              type="button"
            >
              <Camera className="h-3 w-3" />
            </button>
          </div>
          <div className="mb-1 flex-1">
            <p className={`text-base font-semibold ${isDark ? "text-white" : "text-slate-900"}`}>
              {`${form.name} ${form.lastName}`.trim() || "Sin nombre"}
            </p>
            <p className={`text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}>{form.email}</p>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <RoleBadge role={me.role} />
              {me.company && (
                <span className={`text-xs ${isDark ? "text-slate-500" : "text-slate-400"}`}>· {me.company}</span>
              )}
            </div>
          </div>
        </div>

        {/* Color picker */}
        {showColorPicker && (
          <div className={`flex items-center gap-2 border-t px-6 py-3 ${isDark ? "border-slate-800" : "border-slate-100"}`}>
            <p className={`mr-2 text-xs ${isDark ? "text-slate-500" : "text-slate-400"}`}>Color del avatar</p>
            {AVATAR_COLORS.map((c, i) => (
              <button
                className={`h-6 w-6 rounded-full transition-transform hover:scale-110 ${avatarColorIdx === i ? "ring-2 ring-white ring-offset-1 ring-offset-slate-900" : ""}`}
                key={c.label}
                onClick={() => { setAvatarColorIdx(i); setShowColorPicker(false); }}
                style={{ background: `linear-gradient(135deg, ${c.from}, ${c.to})` }}
                title={c.label}
                type="button"
              />
            ))}
          </div>
        )}

        {/* Stats row */}
        <div className={`grid grid-cols-3 divide-x border-t ${isDark ? "divide-slate-800 border-slate-800" : "divide-slate-100 border-slate-100"}`}>
          {statItems.map(({ label, value }) => (
            <div className="py-3 text-center" key={label}>
              <p className={`font-mono text-sm font-semibold ${isDark ? "text-white" : "text-slate-900"}`}>{value}</p>
              <p className={`text-[10px] ${isDark ? "text-slate-500" : "text-slate-400"}`}>{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Profile completeness */}
      <div className={`mb-4 rounded-xl border px-4 py-3 ${isDark ? "border-slate-800 bg-white/[0.02]" : "border-slate-200 bg-white"}`}>
        <div className="mb-2 flex items-center justify-between text-xs">
          <span className={isDark ? "text-slate-400" : "text-slate-600"}>Perfil completado</span>
          <span className={`font-mono font-medium ${pct === 100 ? "text-emerald-400" : isDark ? "text-slate-300" : "text-slate-700"}`}>{pct}%</span>
        </div>
        <div className={`h-1.5 w-full overflow-hidden rounded-full ${isDark ? "bg-slate-800" : "bg-slate-200"}`}>
          <div
            className={`h-full rounded-full transition-all duration-500 ${pct === 100 ? "bg-emerald-500" : "bg-blue-500"}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        {pct < 100 && (
          <p className={`mt-1.5 text-[10px] ${isDark ? "text-slate-600" : "text-slate-400"}`}>
            Completa teléfono y departamento para llegar al 100%
          </p>
        )}
      </div>

      {/* Form */}
      <SettingsCard
        description="Estos datos son visibles para los miembros de tu workspace"
        footer={<SaveButton onSave={onSave} />}
        isDark={isDark}
        title="Información personal"
      >
        <div className="grid grid-cols-2 gap-4">
          <FloatingInput isDark={isDark} label="Nombre" onChange={(name) => setForm((p) => ({ ...p, name }))} value={form.name} />
          <FloatingInput isDark={isDark} label="Apellido" onChange={(lastName) => setForm((p) => ({ ...p, lastName }))} value={form.lastName} />
        </div>
        <div className="mt-4 grid grid-cols-2 gap-4">
          <FloatingInput isDark={isDark} label="Correo electrónico" onChange={(email) => setForm((p) => ({ ...p, email }))} type="email" value={form.email} />
          <FloatingInput isDark={isDark} label="Teléfono" onChange={(phone) => setForm((p) => ({ ...p, phone }))} type="tel" value={form.phone} />
        </div>
        <div className="mt-4">
          <FloatingInput isDark={isDark} label="Departamento / Área" onChange={(department) => setForm((p) => ({ ...p, department }))} value={form.department} />
        </div>
      </SettingsCard>

      {/* Role & org */}
      <SettingsCard description="Gestionado por el administrador" isDark={isDark} title="Rol y organización">
        <div className="grid grid-cols-3 gap-4 py-1">
          {[
            { label: "Empresa", value: me.company ?? "—" },
            { label: "Miembro desde", value: me.createdAt ? new Date(me.createdAt).toLocaleDateString("es-CO") : "—" },
          ].map(({ label, value }) => (
            <div key={label}>
              <p className={`text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}>{label}</p>
              <p className={`mt-0.5 font-mono text-sm ${isDark ? "text-white" : "text-slate-900"}`}>{value}</p>
            </div>
          ))}
          <div>
            <p className={`text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}>Rol asignado</p>
            <div className="mt-1"><RoleBadge role={me.role} /></div>
          </div>
        </div>
      </SettingsCard>

      {/* Last access */}
      {lastSession && (
        <SettingsCard description="Información de tu acceso anterior" isDark={isDark} title="Último acceso">
          <div className="flex items-center gap-3 py-1">
            <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${isDark ? "bg-white/5" : "bg-slate-100"}`}>
              <Monitor className="h-4 w-4 text-slate-400" />
            </div>
            <div>
              <p className={`text-sm ${isDark ? "text-white" : "text-slate-900"}`}>{lastSession.device ?? "Dispositivo desconocido"}</p>
              <div className={`mt-0.5 flex flex-wrap gap-x-3 text-xs ${isDark ? "text-slate-500" : "text-slate-400"}`}>
                {lastSession.ip && lastSession.ip !== "—" && <span className="font-mono">{lastSession.ip}</span>}
                {lastSeenStr && <span>{new Date(lastSeenStr).toLocaleString("es-CO")}</span>}
              </div>
            </div>
          </div>
        </SettingsCard>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------
export default function SettingsPage({
  isDark,
  onSetTheme,
}: {
  isDark: boolean;
  onSetTheme: (dark: boolean) => void;
}) {
  const t = useTranslations("settings");
  const { user, setUser, logout } = useAuth();
  const [tab, setTab] = useState("profile");

  const [me, setMe] = useState<UserProfile | null>(null);
  const [sessions, setSessions] = useState<import("@/types/settings").SessionItem[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [stats, setStats] = useState({ total: 0, admins: 0, active: 0, pending: 0 });
  const [userToRemove, setUserToRemove] = useState<AdminUser | null>(null);
  const [userToSetPassword, setUserToSetPassword] = useState<AdminUser | null>(null);
  const [userToInvalidateSessions, setUserToInvalidateSessions] = useState<AdminUser | null>(null);
  const [newPasswordInput, setNewPasswordInput] = useState("");
  const [showDeleteAccount, setShowDeleteAccount] = useState(false);

  const [form, setForm] = useState({ name: "", lastName: "", email: "", phone: "", department: "" });
  const [avatarColorIdx, setAvatarColorIdx] = useState(0);
  const [pwd, setPwd] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [appearance, setAppearance] = useState<AppearanceState>({
    theme: isDark ? "dark" : "light",
  });
  const [language, setLanguage] = useState<LanguageState>({
    language: "es",
  });
  const [notifications, setNotifications] = useState<NotificationSettings>({
    video_uploaded: true,
    video_processed: true,
  });
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [page, setPage] = useState(1);
  const perPage = 8;

  useEffect(() => {
    void (async () => {
      try {
        const [meData, sessionData, prefData] = await Promise.all([
          settingsService.getMe(),
          settingsService.getSessions(),
          settingsService.getPreferences() as Promise<UserPreferences & { countryCode?: string; language?: string; dateFormat?: string; timezone?: string; notifications?: Partial<NotificationSettings> }>,
        ]);
        setMe(meData);
        setForm({
          name: meData.name ?? "",
          lastName: meData.lastName ?? "",
          email: meData.email,
          phone: (meData as unknown as Record<string, string>).phone ?? "",
          department: (meData as unknown as Record<string, string>).department ?? "",
        });
        const savedColor = (prefData as Record<string, unknown>).avatarColorIdx;
        if (typeof savedColor === "number") setAvatarColorIdx(savedColor);
        setSessions(sessionData);
        const savedTheme = prefData.theme ?? (isDark ? "dark" : "light");
        setAppearance((prev) => ({ ...prev, theme: savedTheme }));
        if (savedTheme === "system") {
          onSetTheme(window.matchMedia("(prefers-color-scheme: dark)").matches);
        }
        if (prefData.language) {
          setLanguage({ language: prefData.language });
        }
        if (prefData.notifications && typeof prefData.notifications === "object") {
          const notifPatch = prefData.notifications as Partial<NotificationSettings>;
          setNotifications((prev) => ({ ...prev, ...notifPatch }));
        }
        if (user?.role === "admin") {
          const [allUsers, allStats] = await Promise.all([
            adminService.getUsers(),
            adminService.getStats(),
          ]);
          setUsers(Array.isArray(allUsers) ? allUsers : []);
          setStats(allStats);
        }
      } catch {
        // server offline — fallback to defaults already set
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep selector in sync when theme toggles externally (e.g. header toggle)
  // Don't override when user has "system" selected — it follows OS, not isDark
  useEffect(() => {
    setAppearance((p) => {
      if (p.theme === "system") return p;
      return { ...p, theme: isDark ? "dark" : "light" };
    });
  }, [isDark]);

  const savePreferences = useCallback(async () => {
    await settingsService.savePreferences({
      ...appearance,
      ...language,
      notifications,
    });
  }, [appearance, language, notifications]);

  const filteredUsers = useMemo(() => {
    const rows = users
      .filter((u) => (roleFilter ? u.role === roleFilter : true))
      .filter((u) => `${u.name ?? ""} ${u.email}`.toLowerCase().includes(search.toLowerCase()));
    const start = (page - 1) * perPage;
    return {
      rows: rows.slice(start, start + perPage),
      total: rows.length,
      totalPages: Math.max(1, Math.ceil(rows.length / perPage)),
    };
  }, [users, roleFilter, search, page]);

  return (
    <div className={`h-full overflow-y-auto`}>
    <div className={`flex flex-col items-start gap-6 p-2 lg:flex-row lg:p-0 ${isDark ? "text-white" : "text-slate-900"}`}>
      <SettingsSidebar activeTab={tab} isDark={isDark} onChange={setTab} userRole={user?.role} />

      <div className="w-full max-w-3xl flex-1">
        {/* Profile */}
        {tab === "profile" && me ? (
          <ProfileSection
            avatarColorIdx={avatarColorIdx}
            form={form}
            isDark={isDark}
            me={me}
            sessions={sessions}
            setAvatarColorIdx={setAvatarColorIdx}
            setForm={setForm}
            onSave={async () => {
              const updated = await settingsService.updateMe(form);
              setMe(updated);
              setUser({ id: String(updated.id), email: updated.email, role: updated.role as "admin" | "viewer" });
              await settingsService.savePreferences({ avatarColorIdx } as never);
            }}
          />
        ) : null}

        {/* Security */}
        {tab === "security" ? (
          <>
            <SettingsCard
              description="Recomendamos actualizar tu contraseña cada 90 días"
              footer={
                <SaveButton
                  label="Actualizar contraseña"
                  onSave={() => settingsService.updatePassword(pwd).then(() => setPwd({ currentPassword: "", newPassword: "", confirmPassword: "" }))}
                />
              }
              isDark={isDark}
              title="Cambiar contraseña"
            >
              <div className="space-y-4">
                <FloatingInput isDark={isDark} label="Contraseña actual" onChange={(currentPassword) => setPwd((p) => ({ ...p, currentPassword }))} type="password" value={pwd.currentPassword} />
                <FloatingInput isDark={isDark} label="Nueva contraseña" onChange={(newPassword) => setPwd((p) => ({ ...p, newPassword }))} type="password" value={pwd.newPassword} />
                <FloatingInput isDark={isDark} label="Confirmar nueva contraseña" onChange={(confirmPassword) => setPwd((p) => ({ ...p, confirmPassword }))} type="password" value={pwd.confirmPassword} />
              </div>
            </SettingsCard>

            <SettingsCard description="Dispositivos donde tienes sesión iniciada" isDark={isDark} title="Sesiones activas">
              {sessions.map((session) => {
                const isCurrent = session.isCurrent ?? session.is_current;
                const lastSeen = session.lastSeen ?? session.last_seen;
                return (
                  <div className={`flex items-start justify-between gap-4 border-b py-3.5 last:border-0 ${isDark ? "border-slate-800" : "border-slate-200"}`} key={session.id}>
                    <div className="flex items-start gap-3">
                      <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${isDark ? "bg-white/5" : "bg-slate-100"}`}>
                        {session.type === "mobile" ? (
                          <Smartphone className="h-4 w-4 text-slate-400" />
                        ) : (
                          <Monitor className="h-4 w-4 text-slate-400" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className={`text-sm font-medium ${isDark ? "text-white" : "text-slate-900"}`}>
                          {session.device ?? "Dispositivo desconocido"}
                        </p>
                        <div className={`mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs ${isDark ? "text-slate-500" : "text-slate-500"}`}>
                          {session.ip && session.ip !== "—" && (
                            <span className="font-mono">{session.ip}</span>
                          )}
                          {(session.city || session.country) && (
                            <span>
                              {[session.city, session.country].filter(Boolean).join(", ")}
                            </span>
                          )}
                          {lastSeen && (
                            <span>{new Date(lastSeen).toLocaleString("es-CO")}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    {isCurrent ? (
                      <span className="shrink-0 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-2 py-1 text-xs text-emerald-400">
                        Sesión actual
                      </span>
                    ) : (
                      <button
                        className="shrink-0 text-xs text-red-400 transition-colors hover:text-red-300"
                        onClick={() =>
                          settingsService.revokeSession(session.id).then(() =>
                            setSessions((p) => p.filter((s) => s.id !== session.id)),
                          )
                        }
                        type="button"
                      >
                        Cerrar sesión
                      </button>
                    )}
                  </div>
                );
              })}
              <button
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-red-500/20 py-2.5 text-sm text-red-400 transition-all hover:bg-red-500/10"
                onClick={() =>
                  Promise.all(
                    sessions.filter((s) => !(s.isCurrent ?? s.is_current)).map((s) => settingsService.revokeSession(s.id)),
                  ).then(() => setSessions((p) => p.filter((s) => s.isCurrent ?? s.is_current)))
                }
                type="button"
              >
                <LogOut className="h-4 w-4" />
                Cerrar todas las demás sesiones
              </button>
            </SettingsCard>

            <SettingsCard isDark={isDark} title="Zona de peligro">
              <div className="flex items-center justify-between">
                <div>
                  <p className={`text-sm ${isDark ? "text-white" : "text-slate-900"}`}>Eliminar mi cuenta</p>
                  <p className="mt-0.5 text-xs text-slate-500">Esta acción es permanente e irreversible</p>
                </div>
                <button
                  className="rounded-xl border border-red-500/30 px-4 py-2 text-sm text-red-400 transition-all hover:bg-red-500/10"
                  onClick={() => setShowDeleteAccount(true)}
                  type="button"
                >
                  Eliminar cuenta
                </button>
              </div>
            </SettingsCard>
          </>
        ) : null}

        {/* Appearance */}
        {tab === "appearance" ? (
          <SettingsCard
            description="Elige cómo se ve la interfaz"
            footer={<SaveButton onSave={savePreferences} />}
            isDark={isDark}
            title="Tema"
          >
            <div className="grid grid-cols-3 gap-3">
              {(["dark", "light", "system"] as const).map((themeKey) => (
                <button
                  className={`relative flex flex-col items-center gap-2 rounded-xl border p-4 transition-all duration-150 ${
                    appearance.theme === themeKey
                      ? "border-blue-500 bg-blue-500/10"
                      : isDark
                        ? "border-slate-700 bg-white/5 hover:border-slate-500"
                        : "border-slate-200 bg-slate-50 hover:border-slate-400"
                  }`}
                  key={themeKey}
                  onClick={() => {
                    const nextDark = themeKey === "system"
                      ? window.matchMedia("(prefers-color-scheme: dark)").matches
                      : themeKey === "dark";
                    setAppearance((p) => ({ ...p, theme: themeKey }));
                    onSetTheme(nextDark);
                  }}
                  type="button"
                >
                  <div
                    className={`h-16 w-full overflow-hidden rounded-lg ${
                      themeKey === "dark" ? "bg-slate-900" : themeKey === "light" ? "bg-slate-100" : "bg-gradient-to-r from-slate-900 to-slate-100"
                    }`}
                  />
                  <span className={`text-xs font-medium ${appearance.theme === themeKey ? "text-blue-400" : isDark ? "text-slate-400" : "text-slate-600"}`}>
                    {themeKey === "dark" ? t("dark") : themeKey === "light" ? t("light") : t("system")}
                  </span>
                  {appearance.theme === themeKey ? (
                    <div className="absolute right-2 top-2 flex h-4 w-4 items-center justify-center rounded-full bg-blue-500">
                      <Check className="h-2.5 w-2.5 text-white" />
                    </div>
                  ) : null}
                </button>
              ))}
            </div>
          </SettingsCard>
        ) : null}

        {/* Language */}
        {tab === "language" ? (
          <LanguageSection isDark={isDark} />
        ) : null}

        {/* Notifications */}
        {tab === "notifications" ? (
          <SettingsCard
            description="Elige qué eventos te notificamos"
            footer={<SaveButton onSave={savePreferences} />}
            isDark={isDark}
            title="Preferencias de notificaciones"
          >
            {(
              [
                { id: "video_uploaded" as const, label: "Video subido", sub: "Cuando un archivo se sube correctamente" },
                { id: "video_processed" as const, label: "Análisis completado", sub: "Cuando YOLO termina de analizar un video" },
              ]
            ).map(({ id, label, sub }) => (
              <div
                className={`flex items-center justify-between border-b py-3.5 last:border-0 ${isDark ? "border-slate-800" : "border-slate-200"}`}
                key={id}
              >
                <div>
                  <p className={`text-sm ${isDark ? "text-white" : "text-slate-900"}`}>{label}</p>
                  <p className="mt-0.5 text-xs text-slate-500">{sub}</p>
                </div>
                <Toggle enabled={notifications[id]} onChange={(val) => setNotifications((p) => ({ ...p, [id]: val }))} />
              </div>
            ))}
          </SettingsCard>
        ) : null}

        {/* Admin — Users */}
        {tab === "users" ? (
          user?.role !== "admin" ? (
            <div className="flex h-64 flex-col items-center justify-center text-center">
              <ShieldOff className="mb-3 h-10 w-10 text-slate-600" />
              <p className="text-sm text-slate-400">No tienes permisos para ver esta sección</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Stats row */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {(
                  [
                    { label: "Total", value: stats.total, Icon: Users, bg: isDark ? "bg-blue-500/10" : "bg-blue-50", text: isDark ? "text-blue-400" : "text-blue-600" },
                    { label: "Admins", value: stats.admins, Icon: ShieldCheck, bg: isDark ? "bg-amber-500/10" : "bg-amber-50", text: isDark ? "text-amber-400" : "text-amber-600" },
                    { label: "Activos hoy", value: stats.active, Icon: Activity, bg: isDark ? "bg-emerald-500/10" : "bg-emerald-50", text: isDark ? "text-emerald-400" : "text-emerald-600" },
                    { label: "Inactivos", value: stats.pending, Icon: Clock, bg: isDark ? "bg-slate-700/50" : "bg-slate-100", text: isDark ? "text-slate-400" : "text-slate-500" },
                  ]
                ).map(({ label, value, Icon, bg, text }) => (
                  <div
                    key={label}
                    className={`flex items-center gap-3 rounded-2xl border p-4 ${isDark ? "border-[rgba(255,255,255,0.06)] bg-surface" : "border-slate-200 bg-white"}`}
                  >
                    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${bg}`}>
                      <Icon className={`h-4 w-4 ${text}`} />
                    </div>
                    <div>
                      <p className={`text-[11px] ${isDark ? "text-slate-500" : "text-slate-400"}`}>{label}</p>
                      <p className={`font-mono text-xl font-bold ${isDark ? "text-white" : "text-slate-900"}`}>{value}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Search */}
              <div className={`flex items-center gap-3 rounded-2xl border p-3 ${isDark ? "border-[rgba(255,255,255,0.06)] bg-surface" : "border-slate-200 bg-white"}`}>
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
                  <input
                    className={`w-full rounded-xl border py-2 pl-8 pr-3 text-sm outline-none transition-colors focus:border-blue-500 ${isDark ? "border-slate-700 bg-white/5 text-white placeholder:text-slate-600" : "border-slate-200 bg-slate-50 text-slate-900 placeholder:text-slate-400"}`}
                    onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                    placeholder="Buscar por nombre o correo..."
                    type="text"
                    value={search}
                  />
                </div>
              </div>

              {/* Role filter pills */}
              <div className="flex flex-wrap gap-1.5">
                {[{ value: "", label: "Todos" }, ...ROLE_OPTIONS].map(({ value, label }) => (
                  <button
                    className={`rounded-full border px-3 py-1 text-xs font-medium transition-all ${
                      roleFilter === value
                        ? "border-blue-500 bg-blue-500/15 text-blue-400"
                        : isDark
                          ? "border-slate-700 bg-white/[0.03] text-slate-400 hover:border-slate-600 hover:text-slate-300"
                          : "border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-700"
                    }`}
                    key={value}
                    onClick={() => { setRoleFilter(value); setPage(1); }}
                    type="button"
                  >
                    {label}
                    {value !== "" && users.filter((u) => u.role === value).length > 0 && (
                      <span className={`ml-1.5 rounded-full px-1 py-0 text-[9px] font-bold tabular-nums ${roleFilter === value ? "bg-blue-500/20 text-blue-300" : isDark ? "bg-white/10 text-slate-500" : "bg-slate-100 text-slate-400"}`}>
                        {users.filter((u) => u.role === value).length}
                      </span>
                    )}
                  </button>
                ))}
              </div>

              {/* Table */}
              <div className={`overflow-hidden rounded-2xl border ${isDark ? "border-[rgba(255,255,255,0.06)] bg-surface" : "border-slate-200 bg-white"}`}>
                {/* Table header */}
                <div className={`grid grid-cols-[1fr_auto_auto_auto] items-center gap-4 border-b px-4 py-2.5 sm:grid-cols-[1fr_auto_auto_auto] ${isDark ? "border-slate-800" : "border-slate-100"}`}>
                  <span className={`text-[11px] font-medium uppercase tracking-wider ${isDark ? "text-slate-500" : "text-slate-400"}`}>Usuario</span>
                  <span className={`hidden text-[11px] font-medium uppercase tracking-wider sm:block ${isDark ? "text-slate-500" : "text-slate-400"}`}>Rol</span>
                  <span className={`hidden text-[11px] font-medium uppercase tracking-wider sm:block ${isDark ? "text-slate-500" : "text-slate-400"}`}>Última vez</span>
                  <span className={`text-[11px] font-medium uppercase tracking-wider ${isDark ? "text-slate-500" : "text-slate-400"}`}>Acciones</span>
                </div>

                {filteredUsers.rows.length === 0 ? (
                  <div className="flex flex-col items-center justify-center gap-3 py-14 text-center">
                    <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${isDark ? "bg-white/5" : "bg-slate-100"}`}>
                      <Users className="h-5 w-5 text-slate-500" />
                    </div>
                    <p className={`text-sm ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                      {search ? `Sin resultados para "${search}"` : "Sin usuarios registrados"}
                    </p>
                    {search && (
                      <button className="text-xs text-blue-400 hover:text-blue-300" onClick={() => setSearch("")} type="button">
                        Limpiar búsqueda
                      </button>
                    )}
                  </div>
                ) : (
                  <div>
                    {filteredUsers.rows.map((u, idx) => {
                      const palette = [
                        { ring: "ring-blue-500/30", bg: "bg-blue-600/15", text: "text-blue-400" },
                        { ring: "ring-violet-500/30", bg: "bg-violet-600/15", text: "text-violet-400" },
                        { ring: "ring-emerald-500/30", bg: "bg-emerald-600/15", text: "text-emerald-400" },
                        { ring: "ring-amber-500/30", bg: "bg-amber-600/15", text: "text-amber-400" },
                        { ring: "ring-pink-500/30", bg: "bg-pink-600/15", text: "text-pink-400" },
                        { ring: "ring-cyan-500/30", bg: "bg-cyan-600/15", text: "text-cyan-400" },
                      ];
                      const color = palette[idx % palette.length]!;
                      const isMe = u.id === user?.id;
                      const relTime = u.lastSeen
                        ? (() => {
                            const diff = Date.now() - new Date(u.lastSeen).getTime();
                            const m = Math.floor(diff / 60000);
                            if (m < 2) return "Ahora";
                            if (m < 60) return `${m}m`;
                            const h = Math.floor(m / 60);
                            if (h < 24) return `${h}h`;
                            const d = Math.floor(h / 24);
                            if (d < 30) return `${d}d`;
                            return new Date(u.lastSeen).toLocaleDateString("es-CO", { day: "2-digit", month: "short" });
                          })()
                        : "—";

                      return (
                        <div
                          key={u.id}
                          className={`grid grid-cols-[1fr_auto_auto_auto] items-center gap-4 border-b px-4 py-3 transition-colors last:border-0 sm:grid-cols-[1fr_auto_auto_auto] ${
                            isDark ? "border-slate-800/60 hover:bg-white/[0.025]" : "border-slate-100 hover:bg-slate-50/70"
                          }`}
                        >
                          {/* Avatar + name */}
                          <div className="flex min-w-0 items-center gap-3">
                            <div className={`relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ring-1 ${color.ring} ${color.bg}`}>
                              <span className={`text-xs font-bold ${color.text}`}>
                                {u.initials ?? u.email[0]?.toUpperCase() ?? "?"}
                              </span>
                              <span className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full ring-2 ${isDark ? "ring-[var(--surface)]" : "ring-white"} ${u.status === "active" ? "bg-emerald-400" : "bg-slate-500"}`} />
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <p className={`truncate text-sm font-medium ${isDark ? "text-white" : "text-slate-900"}`}>
                                  {u.name ?? u.email.split("@")[0]}
                                </p>
                                {isMe && (
                                  <span className="shrink-0 rounded-full bg-blue-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-blue-400">Tú</span>
                                )}
                              </div>
                              <p className={`truncate text-xs ${isDark ? "text-slate-500" : "text-slate-400"}`}>{u.email}</p>
                              {/* role on mobile */}
                              <div className="mt-1 sm:hidden">
                                {isMe ? <RoleBadge role={u.role} /> : (
                                  <RoleSelector
                                    isDark={isDark}
                                    onChange={(id, role) =>
                                      adminService.patchRole(id, role as "admin" | "viewer")
                                        .then(() => setUsers((prev) => prev.map((row) => (row.id === id ? { ...row, role } : row))))
                                    }
                                    user={u}
                                  />
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Role — desktop */}
                          <div className="hidden sm:block">
                            {isMe ? (
                              <RoleBadge role={u.role} />
                            ) : (
                              <RoleSelector
                                isDark={isDark}
                                onChange={(id, role) =>
                                  adminService.patchRole(id, role as "admin" | "viewer")
                                    .then(() => setUsers((prev) => prev.map((row) => (row.id === id ? { ...row, role } : row))))
                                }
                                user={u}
                              />
                            )}
                          </div>

                          {/* Last seen — desktop */}
                          <div className={`hidden sm:block text-right text-xs tabular-nums ${isDark ? "text-slate-500" : "text-slate-400"}`}>
                            {relTime}
                          </div>

                          {/* Action buttons */}
                          <div className="flex shrink-0 items-center gap-0.5">
                            {!isMe ? (
                              <>
                                <button
                                  className={`rounded-lg p-1.5 transition-colors hover:bg-amber-500/10 hover:text-amber-400 ${isDark ? "text-slate-500" : "text-slate-400"}`}
                                  onClick={() => { setUserToSetPassword(u); setNewPasswordInput(""); }}
                                  title="Cambiar contraseña"
                                  type="button"
                                >
                                  <KeyRound className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  className={`rounded-lg p-1.5 transition-colors hover:bg-blue-500/10 hover:text-blue-400 ${isDark ? "text-slate-500" : "text-slate-400"}`}
                                  onClick={() => setUserToInvalidateSessions(u)}
                                  title="Cerrar sesiones activas"
                                  type="button"
                                >
                                  <LogOut className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  className={`rounded-lg p-1.5 transition-colors hover:bg-red-500/10 hover:text-red-400 ${isDark ? "text-slate-500" : "text-slate-400"}`}
                                  onClick={() => setUserToRemove(u)}
                                  title="Revocar acceso"
                                  type="button"
                                >
                                  <UserX className="h-3.5 w-3.5" />
                                </button>
                              </>
                            ) : (
                              <div className="w-[82px]" />
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Pagination */}
              {filteredUsers.totalPages > 1 && (
                <div className="flex items-center justify-between">
                  <p className={`text-xs ${isDark ? "text-slate-600" : "text-slate-400"}`}>
                    {(page - 1) * perPage + 1}–{Math.min(page * perPage, filteredUsers.total)} de {filteredUsers.total}
                  </p>
                  <div className="flex gap-1">
                    {[...Array(filteredUsers.totalPages)].map((_, i) => (
                      <button
                        className={`h-7 w-7 rounded-lg text-xs transition-colors ${page === i + 1 ? "bg-blue-600 text-white" : isDark ? "bg-white/5 text-slate-400 hover:bg-white/10" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
                        key={i}
                        onClick={() => setPage(i + 1)}
                        type="button"
                      >
                        {i + 1}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )
        ) : null}
      </div>

      {/* Modals */}
      {showDeleteAccount ? (
        <ConfirmModal
          confirmWord="ELIMINAR"
          danger
          description='Escribe "ELIMINAR" para confirmar. Perderás todos tus videos y datos.'
          isDark={isDark}
          onCancel={() => setShowDeleteAccount(false)}
          onConfirm={async () => {
            await settingsService.deleteMe();
            await logout();
          }}
          title="¿Eliminar tu cuenta?"
        />
      ) : null}

      {userToRemove ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div
            className={`mx-4 w-full max-w-sm rounded-2xl border p-6 ${isDark ? "border-slate-700 bg-[#0D1117]" : "border-slate-200 bg-white"}`}
          >
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-red-500/20 bg-red-500/10">
              <UserX className="h-5 w-5 text-red-400" />
            </div>
            <h3 className={`mb-1 text-base font-semibold ${isDark ? "text-white" : "text-slate-900"}`}>Revocar acceso</h3>
            <p className={`mb-6 text-sm ${isDark ? "text-slate-400" : "text-slate-600"}`}>
              ¿Eliminar a <span className={isDark ? "text-white" : "text-slate-900"}>{userToRemove.name}</span> del workspace?
            </p>
            <div className="flex gap-3">
              <button
                className={`flex-1 rounded-xl border py-2.5 text-sm transition-all ${isDark ? "border-slate-700 text-slate-400 hover:bg-white/5" : "border-slate-300 text-slate-700 hover:bg-slate-100"}`}
                onClick={() => setUserToRemove(null)}
                type="button"
              >
                Cancelar
              </button>
              <button
                className="flex-1 rounded-xl bg-red-600 py-2.5 text-sm text-white transition-all hover:bg-red-500"
                onClick={async () => {
                  await adminService.deleteUser(userToRemove.id);
                  setUsers((prev) => prev.filter((u) => u.id !== userToRemove.id));
                  setUserToRemove(null);
                }}
                type="button"
              >
                Sí, revocar
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* ── Invalidate sessions modal ──────────────────────────────────── */}
      {userToInvalidateSessions ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className={`mx-4 w-full max-w-sm rounded-2xl border p-6 ${isDark ? "border-slate-700 bg-[#0D1117]" : "border-slate-200 bg-white"}`}>
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-blue-500/20 bg-blue-500/10">
              <LogOut className="h-5 w-5 text-blue-400" />
            </div>
            <h3 className={`mb-1 text-base font-semibold ${isDark ? "text-white" : "text-slate-900"}`}>Cerrar sesiones</h3>
            <p className={`mb-6 text-sm ${isDark ? "text-slate-400" : "text-slate-600"}`}>
              Se cerrarán todas las sesiones activas de{" "}
              <span className={isDark ? "text-white" : "text-slate-900"}>
                {userToInvalidateSessions.name ?? userToInvalidateSessions.email}
              </span>
              . Tendrá que iniciar sesión de nuevo.
            </p>
            <div className="flex gap-3">
              <button
                className={`flex-1 rounded-xl border py-2.5 text-sm transition-all ${isDark ? "border-slate-700 text-slate-400 hover:bg-white/5" : "border-slate-300 text-slate-700 hover:bg-slate-100"}`}
                onClick={() => setUserToInvalidateSessions(null)}
                type="button"
              >
                Cancelar
              </button>
              <button
                className="flex-1 rounded-xl bg-blue-600 py-2.5 text-sm text-white transition-all hover:bg-blue-500"
                onClick={async () => {
                  await adminService.invalidateSessions(userToInvalidateSessions.id);
                  setUserToInvalidateSessions(null);
                }}
                type="button"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* ── Set password modal ─────────────────────────────────────────── */}
      {userToSetPassword ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className={`mx-4 w-full max-w-sm rounded-2xl border p-6 ${isDark ? "border-slate-700 bg-[#0D1117]" : "border-slate-200 bg-white"}`}>
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-amber-500/20 bg-amber-500/10">
              <KeyRound className="h-5 w-5 text-amber-400" />
            </div>
            <h3 className={`mb-1 text-base font-semibold ${isDark ? "text-white" : "text-slate-900"}`}>Cambiar contraseña</h3>
            <p className={`mb-4 text-sm ${isDark ? "text-slate-400" : "text-slate-600"}`}>
              Nueva contraseña para <span className={isDark ? "text-white" : "text-slate-900"}>{userToSetPassword.name ?? userToSetPassword.email}</span>
            </p>
            <input
              className={`mb-4 w-full rounded-xl border px-4 py-2.5 text-sm outline-none focus:border-amber-400 ${isDark ? "border-slate-700 bg-white/5 text-white placeholder:text-slate-600" : "border-slate-300 bg-white text-slate-900 placeholder:text-slate-400"}`}
              minLength={8}
              onChange={(e) => setNewPasswordInput(e.target.value)}
              placeholder="Mínimo 8 caracteres"
              type="password"
              value={newPasswordInput}
            />
            <div className="flex gap-3">
              <button
                className={`flex-1 rounded-xl border py-2.5 text-sm transition-all ${isDark ? "border-slate-700 text-slate-400 hover:bg-white/5" : "border-slate-300 text-slate-700 hover:bg-slate-100"}`}
                onClick={() => setUserToSetPassword(null)}
                type="button"
              >
                Cancelar
              </button>
              <button
                className="flex-1 rounded-xl bg-amber-600 py-2.5 text-sm text-white transition-all hover:bg-amber-500 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={newPasswordInput.length < 8}
                onClick={async () => {
                  await adminService.setPassword(userToSetPassword.id, newPasswordInput);
                  setUserToSetPassword(null);
                  setNewPasswordInput("");
                }}
                type="button"
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
    </div>
  );
}
