"use client";

import * as React from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { IconButton } from "./ui";
import { useLanguage } from "../i18n/LanguageContext";

const noop = () => () => {};

export function ThemeToggle({ variant = "fill" }: { variant?: "glass" | "fill" }) {
  const { resolvedTheme, setTheme } = useTheme();
  const { t } = useLanguage();
  // resolvedTheme is unknown on the server; render the light icon until hydrated.
  const mounted = React.useSyncExternalStore(noop, () => true, () => false);

  const isDark = mounted && resolvedTheme === "dark";

  return (
    <IconButton variant={variant} label={t("sys.toggleTheme")} onClick={() => setTheme(isDark ? "light" : "dark")}>
      <span className="relative w-[18px] h-[18px]">
        <Sun
          size={18}
          className={`absolute inset-0 transition-all duration-500 ease-[var(--ease-spring)] ${isDark ? "opacity-100 rotate-0 scale-100" : "opacity-0 -rotate-90 scale-50"}`}
        />
        <Moon
          size={18}
          className={`absolute inset-0 transition-all duration-500 ease-[var(--ease-spring)] ${isDark ? "opacity-0 rotate-90 scale-50" : "opacity-100 rotate-0 scale-100"}`}
        />
      </span>
    </IconButton>
  );
}
