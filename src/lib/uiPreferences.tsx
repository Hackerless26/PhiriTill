import type { ReactNode } from "react";
import { createContext, useContext, useEffect, useMemo, useState } from "react";

export type UiPreferences = {
  theme: "light" | "mist";
  layout: "vertical" | "horizontal";
  sidebarVariant: "full" | "mini" | "compact" | "overlay" | "icon-hover";
  sidebarPosition: "left" | "right";
  headerPosition: "fixed" | "static";
};

type UiContextValue = {
  prefs: UiPreferences;
  updatePrefs: (next: Partial<UiPreferences>) => void;
};

const defaultPrefs: UiPreferences = {
  theme: "light",
  layout: "vertical",
  sidebarVariant: "full",
  sidebarPosition: "left",
  headerPosition: "fixed",
};

const UiPreferencesContext = createContext<UiContextValue | null>(null);

const STORAGE_KEY = "poxpos-ui-prefs";

export function UiPreferencesProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState<UiPreferences>(defaultPrefs);

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as Partial<UiPreferences>;
        setPrefs((prev) => ({ ...prev, ...parsed }));
      } catch {
        setPrefs(defaultPrefs);
      }
    }
  }, []);

  const updatePrefs = (next: Partial<UiPreferences>) => {
    setPrefs((prev) => {
      const updated = { ...prev, ...next };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  };

  const value = useMemo(() => ({ prefs, updatePrefs }), [prefs]);

  return (
    <UiPreferencesContext.Provider value={value}>
      {children}
    </UiPreferencesContext.Provider>
  );
}

export function useUiPreferences() {
  const context = useContext(UiPreferencesContext);
  if (!context) {
    throw new Error("useUiPreferences must be used within UiPreferencesProvider");
  }
  return context;
}
