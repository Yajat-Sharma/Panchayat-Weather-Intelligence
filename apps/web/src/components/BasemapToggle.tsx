"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { Map as MapIcon, Satellite } from "lucide-react";
import { useLanguage } from "../i18n/LanguageContext";
import type { Basemap } from "./Map";
import { cx } from "./ui";

const OPTIONS: { id: Basemap; icon: typeof MapIcon; label: string }[] = [
  { id: "satellite", icon: Satellite, label: "map.satellite" },
  { id: "map", icon: MapIcon, label: "map.standard" },
];

/** Glass segmented control (desktop) with a sliding thumb. */
export function BasemapSegmented({ value, onChange }: { value: Basemap; onChange: (b: Basemap) => void }) {
  const { t } = useLanguage();
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [thumb, setThumb] = useState<{ x: number; w: number } | null>(null);

  useLayoutEffect(() => {
    const el = refs.current[value];
    if (el) setThumb({ x: el.offsetLeft, w: el.offsetWidth });
  }, [value, t]);

  return (
    <div role="radiogroup" aria-label={t("map.mode")} className="relative flex items-center p-1 rounded-full glass shadow-float">
      {thumb && (
        <span
          aria-hidden
          className="absolute top-1 bottom-1 rounded-full bg-elevated shadow-[0_1px_3px_rgb(0_0_0/0.14)] transition-all duration-500 ease-[var(--ease-spring)]"
          style={{ left: thumb.x, width: thumb.w }}
        />
      )}
      {OPTIONS.map(({ id, icon: Icon, label }) => (
        <button
          key={id}
          ref={el => { refs.current[id] = el; }}
          role="radio"
          aria-checked={value === id}
          onClick={() => onChange(id)}
          className={cx(
            "relative z-10 flex items-center gap-1.5 h-8 px-3 rounded-full text-[13px] font-semibold transition-colors duration-300",
            value === id ? "text-label" : "text-label-2 hover:text-label"
          )}
        >
          <Icon size={15} />
          {t(label)}
        </button>
      ))}
    </div>
  );
}

/** Single round glass button (mobile): shows the style you'll switch to. */
export function BasemapButton({ value, onChange }: { value: Basemap; onChange: (b: Basemap) => void }) {
  const { t } = useLanguage();
  const next = value === "satellite" ? OPTIONS[1] : OPTIONS[0];
  const Icon = next.icon;
  return (
    <button
      type="button"
      onClick={() => onChange(next.id)}
      aria-label={`${t("map.mode")}: ${t(next.label)}`}
      title={t(next.label)}
      className="pressable glass shadow-float grid place-items-center w-9 h-9 rounded-full text-label"
    >
      <Icon key={next.id} size={17} className="animate-pop" />
    </button>
  );
}
