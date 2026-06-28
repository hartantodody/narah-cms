import i18n from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { initReactI18next } from "react-i18next";
import enCommon from "@/locales/en/common.json";
import idCommon from "@/locales/id/common.json";

export const SUPPORTED_LOCALES = ["en", "id"] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];

export const LOCALE_LABELS: Record<Locale, string> = {
  en: "English",
  id: "Bahasa Indonesia",
};

export const LOCALE_FLAGS: Record<Locale, string> = {
  en: "EN",
  id: "ID",
};

const STORAGE_KEY = "narah.locale";

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { common: enCommon },
      id: { common: idCommon },
    },
    fallbackLng: "en",
    supportedLngs: SUPPORTED_LOCALES as unknown as string[],
    defaultNS: "common",
    ns: ["common"],
    interpolation: { escapeValue: false },
    detection: {
      order: ["localStorage", "navigator"],
      lookupLocalStorage: STORAGE_KEY,
      caches: ["localStorage"],
    },
    returnNull: false,
  });

export const setLocale = (locale: Locale) => {
  void i18n.changeLanguage(locale);
};

export const getCurrentLocale = (): Locale => {
  const lang = i18n.resolvedLanguage ?? i18n.language ?? "en";
  return (SUPPORTED_LOCALES as readonly string[]).includes(lang)
    ? (lang as Locale)
    : "en";
};

export default i18n;
