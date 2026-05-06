"use client";

import { SettingsCard } from "@/components/ui/SettingsCard";
import { CheckCircle2, Globe } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";

const LANGUAGES = [
  {
    code: "es",
    label: "Español",
    sub: "Spanish",
    flag: "🇨🇴",
  },
  {
    code: "en",
    label: "English",
    sub: "Inglés",
    flag: "🇺🇸",
  },
] as const;

export interface LanguageState {
  language: string;
}

export default function LanguageSection({
  isDark = true,
}: {
  isDark?: boolean;
  // Keep for backwards compat — unused now
  language?: LanguageState;
  setLanguage?: React.Dispatch<React.SetStateAction<LanguageState>>;
  onSave?: () => Promise<void>;
}) {
  const t = useTranslations("settings");
  const activeLocale = useLocale();
  const router = useRouter();
  const [selected, setSelected] = useState(activeLocale);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setSaving(true);
    document.cookie = `NEXT_LOCALE=${selected}; path=/; max-age=31536000; SameSite=Lax`;
    setSaved(true);
    window.setTimeout(() => router.refresh(), 600);
  };

  return (
    <SettingsCard
      description={t("languageDesc")}
      footer={
        <button
          className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-medium text-white transition-all hover:bg-blue-500 disabled:opacity-50"
          disabled={saving || selected === activeLocale}
          onClick={handleSave}
          type="button"
        >
          <Globe className="h-4 w-4" />
          {saved ? (
            <><CheckCircle2 className="h-4 w-4" /> {t("saved")}</>
          ) : (
            t("saveLanguage")
          )}
        </button>
      }
      isDark={isDark}
      title={t("languageTitle")}
    >
      <div className="grid grid-cols-2 gap-3">
        {LANGUAGES.map((lang) => {
          const isActive = selected === lang.code;
          return (
            <button
              className={`relative flex items-center gap-4 rounded-xl border p-4 text-left transition-all duration-150 ${
                isActive
                  ? "border-blue-500 bg-blue-500/10"
                  : isDark
                    ? "border-slate-700 bg-white/5 hover:border-slate-500"
                    : "border-slate-200 bg-slate-50 hover:border-slate-400"
              }`}
              key={lang.code}
              onClick={() => setSelected(lang.code)}
              type="button"
            >
              <span className="text-3xl leading-none">{lang.flag}</span>
              <div>
                <p className={`text-sm font-semibold ${isActive ? "text-blue-400" : isDark ? "text-white" : "text-slate-900"}`}>
                  {lang.label}
                </p>
                <p className={`text-xs ${isDark ? "text-slate-500" : "text-slate-400"}`}>
                  {lang.sub}
                </p>
              </div>
              {isActive && (
                <div className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-blue-500">
                  <CheckCircle2 className="h-3 w-3 text-white" />
                </div>
              )}
            </button>
          );
        })}
      </div>

      {selected !== activeLocale && (
        <p className={`mt-3 text-xs ${isDark ? "text-slate-500" : "text-slate-400"}`}>
          {selected === "en"
            ? "The interface will switch to English after saving."
            : "La interfaz cambiará a Español al guardar."}
        </p>
      )}
    </SettingsCard>
  );
}
