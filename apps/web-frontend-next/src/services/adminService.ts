import { apiDelete, apiGet, apiPatch } from "@/lib/api-client";
import type { AdminStats, AdminUser } from "@/types/settings";

export const adminService = {
  getUsers: () =>
    apiGet<AdminUser[]>("/admin/users"),

  getStats: () => apiGet<AdminStats>("/admin/users/stats"),

  patchRole: (id: number | string, role: "admin" | "viewer") =>
    apiPatch<{ status: string; id: number | string; role: string }>(
      `/admin/users/${id}/role`,
      { role },
    ),

  deleteUser: (id: number | string) => apiDelete(`/admin/users/${id}`),

  setPassword: (id: number | string, newPassword: string) =>
    apiPatch<{ status: string }>(`/admin/users/${id}/password`, { new_password: newPassword }),

  invalidateSessions: (id: number | string) =>
    apiDelete(`/admin/users/${id}/sessions`),
};
