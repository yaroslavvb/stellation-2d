import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import {
  DEFAULT_THEME_PREFERENCE,
  nextThemePreference,
  normalizeThemePreference,
  resolveTheme,
  storedThemePreference,
  THEME_BOOTSTRAP_SCRIPT,
  THEME_STORAGE_KEY,
} from "../app/theme.ts";

function runBootstrap(stored, systemDark, storageThrows = false) {
  const root = { dataset: {}, style: {} };
  const themeColor = {
    content: null,
    setAttribute(name, value) {
      if (name === "content") this.content = value;
    },
  };
  vm.runInNewContext(THEME_BOOTSTRAP_SCRIPT, {
    document: {
      documentElement: root,
      querySelector: () => themeColor,
    },
    localStorage: {
      getItem() {
        if (storageThrows) throw new Error("blocked");
        return stored;
      },
    },
    matchMedia: () => ({ matches: systemDark }),
  });
  return { root, themeColor };
}

test("defaults missing and invalid preferences to System", () => {
  assert.equal(DEFAULT_THEME_PREFERENCE, "system");
  assert.equal(THEME_STORAGE_KEY, "theme");
  assert.equal(normalizeThemePreference(null), "system");
  assert.equal(normalizeThemePreference(undefined), "system");
  assert.equal(normalizeThemePreference("unknown"), "system");
});

test("accepts Great Stella's auto value as System", () => {
  assert.equal(normalizeThemePreference("auto"), "system");
  assert.equal(normalizeThemePreference("system"), "system");
  assert.equal(storedThemePreference("system"), "auto");
  assert.equal(storedThemePreference("light"), "light");
  assert.equal(storedThemePreference("dark"), "dark");
});

test("resolves explicit themes independently of the system", () => {
  assert.equal(resolveTheme("light", false), "light");
  assert.equal(resolveTheme("light", true), "light");
  assert.equal(resolveTheme("dark", false), "dark");
  assert.equal(resolveTheme("dark", true), "dark");
});

test("System tracks both operating-system appearances", () => {
  assert.equal(resolveTheme("system", false), "light");
  assert.equal(resolveTheme("system", true), "dark");
});

test("cycles in Great Stella order", () => {
  assert.equal(nextThemePreference("system"), "light");
  assert.equal(nextThemePreference("light"), "dark");
  assert.equal(nextThemePreference("dark"), "system");
});

test("pre-paint bootstrap resolves stored and blocked-storage preferences", () => {
  const explicitLight = runBootstrap("light", true);
  assert.deepEqual(explicitLight.root.dataset, {
    theme: "light",
    themePref: "light",
  });
  assert.equal(explicitLight.root.style.colorScheme, "light");
  assert.equal(explicitLight.themeColor.content, "#f2f4f7");

  const systemDark = runBootstrap("auto", true);
  assert.deepEqual(systemDark.root.dataset, {
    theme: "dark",
    themePref: "auto",
  });
  assert.equal(systemDark.themeColor.content, "#090b10");

  const blockedLightSystem = runBootstrap(null, false, true);
  assert.deepEqual(blockedLightSystem.root.dataset, {
    theme: "light",
    themePref: "auto",
  });
});
