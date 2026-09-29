"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { Languages } from "lucide-react";
import { useLanguage } from "../i18n/LanguageContext";
import { LanguageCode } from "../i18n/translations";
import { cx } from "./ui";

const OPTIONS: { code: LanguageCode; short: string; name: string }[] = [
  { code: "en", short: "EN", name: "English" },
  { code: "hi", short: "हि", name: "हिंदी" },
  { code: "mr", short: "म", name: "मराठी" },
];

/** Segmented control with a sliding thumb (desktop). */
export function LanguageSegmented() {
  const { language, setLanguage, t } = useLanguage();
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [thumb, setThumb] = useState<{ x: number; w: number } | null>(null);

  useLayoutEffect(() => {
    const el = refs.current[language];
    if (el) setThumb({ x: el.offsetLeft, w: el.offsetWidth });
  }, [language]);

  return (
    <div role="radiogroup" aria-label={t("sys.language")} className="relative flex items-center p-[3px] rounded-full bg-fill-2">
      {thumb && (
        <span
          aria-hidden
          className="absolute top-[3px] bottom-[3px] rounded-full bg-elevated shadow-[0_1px_3px_rgb(0_0_0/0.12),0_0_0_0.5px_rgb(0_0_0/0.04)] transition-all duration-500 ease-[var(--ease-spring)]"
          style={{ left: thumb.x, width: thumb.w }}
        />
      )}
      {OPTIONS.map(o => (
        <button
          key={o.code}
          ref={el => { refs.current[o.code] = el; }}
          role="radio"
          aria-checked={language === o.code}
          aria-label={o.name}
          title={o.name}
          onClick={() => setLanguage(o.code)}
          className={cx(
            "relative z-10 h-[26px] min-w-[34px] px-2.5 rounded-full text-[12.5px] font-semibold transition-colors duration-300",
            language === o.code ? "text-label" : "text-label-2 hover:text-label"
          )}
        >
          {o.short}
        </button>
      ))}
    </div>
  );
}

/** Compact globe button backed by a native select — gets the OS picker on phones. */
export function LanguageButton() {
  const { language, setLanguage, t } = useLanguage();
  const current = OPTIONS.find(o => o.code === language)!;
  return (
    <label className="pressable relative glass shadow-float rounded-full h-9 pl-2.5 pr-3 flex items-center gap-1.5 text-label text-[13px] font-semibold">
      <Languages size={16} />
      <span>{current.short}</span>
      <select
        value={language}
        onChange={e => setLanguage(e.target.value as LanguageCode)}
        aria-label={t("sys.language")}
        className="absolute inset-0 opacity-0 cursor-pointer"
      >
        {OPTIONS.map(o => (
          <option key={o.code} value={o.code}>{o.name}</option>
        ))}
      </select>
    </label>
  );
}
