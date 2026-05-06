import { apiDelete, apiGet, apiPatch, apiPut } from "@/lib/api-client";
import type { SessionItem, UserPreferences, UserProfile } from "@/types/settings";

export const settingsService = {
  getMe: () => apiGet<UserProfile>("/users/me"),
  updateMe: (data: Partial<UserProfile>) => apiPut<UserProfile>("/users/me", data),
  deleteMe: () => apiDelete("/users/me"),

  updatePassword: (data: {
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
  }) => apiPut<{ status: string }>("/users/me/password", data),

  getPreferences: () => apiGet<UserPreferences>("/users/me/preferences"),
  savePreferences: (data: UserPreferences) =>
    apiPut<{ status: string; preferences: UserPreferences }>(
      "/users/me/preferences",
      data,
    ),

  getSessions: () => apiGet<SessionItem[]>("/users/me/sessions"),
  revokeSession: (id: number | string) =>
    apiDelete(`/users/me/sessions/${id}`),
};
