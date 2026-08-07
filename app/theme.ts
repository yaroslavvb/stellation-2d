export type ThemePreference = "system" | "light" | "dark";
export type ResolvedTheme = "light" | "dark";

export const THEME_STORAGE_KEY = "theme";
export const THEME_MEDIA_QUERY = "(prefers-color-scheme: dark)";
export const DEFAULT_THEME_PREFERENCE: ThemePreference = "system";

export function normalizeThemePreference(value: string | null | undefined): ThemePreference {
  if (value === "light" || value === "dark") return value;
  if (value === "system" || value === "auto") return "system";
  return DEFAULT_THEME_PREFERENCE;
}

export function storedThemePreference(preference: ThemePreference) {
  return preference === "system" ? "auto" : preference;
}

export function resolveTheme(
  preference: ThemePreference,
  systemPrefersDark: boolean,
): ResolvedTheme {
  if (preference === "light" || preference === "dark") return preference;
  return systemPrefersDark ? "dark" : "light";
}

export function nextThemePreference(preference: ThemePreference): ThemePreference {
  if (preference === "system") return "light";
  if (preference === "light") return "dark";
  return "system";
}

export const THEME_BOOTSTRAP_SCRIPT = `(() => {
  const root = document.documentElement;
  let preference = "auto";
  try {
    const saved = localStorage.getItem("${THEME_STORAGE_KEY}");
    if (saved === "light" || saved === "dark" || saved === "auto" || saved === "system") {
      preference = saved === "system" ? "auto" : saved;
    }
  } catch {}
  const systemDark = typeof matchMedia === "function" && matchMedia("${THEME_MEDIA_QUERY}").matches;
  const resolved = preference === "dark" || (preference === "auto" && systemDark) ? "dark" : "light";
  root.dataset.theme = resolved;
  root.dataset.themePref = preference;
  root.style.colorScheme = resolved;
  const themeColor = document.querySelector('meta[name="theme-color"]');
  if (themeColor) themeColor.setAttribute("content", resolved === "dark" ? "#090b10" : "#f2f4f7");
})();`;
