"use client";

import { useState } from "react";
import { Layers, Loader2, X } from "lucide-react";
import { useLanguage } from "../i18n/LanguageContext";
import { VARIABLES, type VarKey } from "../lib/api";
import type { Quantized } from "../lib/scale";
import { parseDay } from "../lib/weather";
import { cx } from "./ui";

export type LayerMode = "outlines" | "coarse" | "downscaled";
export interface LayerState {
  mode: LayerMode;
  variable: VarKey;
  date: string | null;
}

interface Props {
  value: LayerState;
  onChange: (v: LayerState) => void;
  dates: string[];
  scale: Quantized | null;
  unit: string;
  status: "idle" | "loading" | "error";
  /** False when the variable has no trained model: the "downscaled" view is the physical baseline only. */
  modelTrained: boolean;
  compact?: boolean;
}

const MODES: LayerMode[] = ["outlines", "coarse", "downscaled"];

function Chips<T extends string>({ items, value, onChange, label, render }: {
  items: readonly T[]; value: T | null; onChange: (v: T) => void; label: string; render: (v: T) => string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex gap-1 overflow-x-auto hide-scrollbar">
      {items.map(it => (
        <button
          key={it}
          role="radio"
          aria-checked={value === it}
          onClick={() => onChange(it)}
          className={cx(
            "pressable shrink-0 h-7 px-2.5 rounded-full text-[12.5px] font-semibold whitespace-nowrap transition-colors",
            value === it ? "bg-accent text-white" : "bg-fill-2 text-label-2 hover:text-label"
          )}
        >
          {render(it)}
        </button>
      ))}
    </div>
  );
}

function Legend({ scale, unit }: { scale: Quantized; unit: string }) {
  const fmt = (v: number) => (Math.abs(v) >= 10 ? Math.round(v).toString() : v.toFixed(1));
  return (
    <figure className="mt-1">
      <div className="flex h-2.5 rounded-full overflow-hidden gap-[2px]" aria-hidden>
        {scale.colors.map(c => <span key={c} className="flex-1" style={{ background: c }} />)}
      </div>
      <figcaption className="flex justify-between text-[11.5px] text-label-2 tabular mt-1">
        <span>{fmt(scale.domain[0])}</span>
        <span>{fmt((scale.domain[0] + scale.domain[1]) / 2)}</span>
        <span>{fmt(scale.domain[1])} {unit}</span>
      </figcaption>
    </figure>
  );
}

export default function ForecastLayerControl({ value, onChange, dates, scale, unit, status, modelTrained, compact }: Props) {
  const { t, locale } = useLanguage();
  const [open, setOpen] = useState(false);
  const active = value.mode !== "outlines";
  const set = (patch: Partial<LayerState>) => onChange({ ...value, ...patch });
  const dayName = (d: string) => {
    const i = dates.indexOf(d);
    return i === 0 ? t("weather.today") : parseDay(d).toLocaleDateString(locale, { weekday: "short", day: "numeric" });
  };

  if (compact && !open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t("layer.title")}
        title={t("layer.title")}
        className={cx("pressable glass shadow-float grid place-items-center w-9 h-9 rounded-full", active ? "text-accent" : "text-label")}
      >
        <Layers size={17} />
      </button>
    );
  }

  return (
    <div className={cx("glass shadow-float rounded-[20px] p-3 flex flex-col gap-2.5 animate-fade", compact ? "w-[min(320px,calc(100vw-24px))]" : "w-[300px]")}>
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-[0.06em] text-label-2">
          <Layers size={13} /> {t("layer.title")}
          {status === "loading" && <Loader2 size={13} className="animate-spin text-accent" />}
        </span>
        {compact && (
          <button onClick={() => setOpen(false)} aria-label={t("panchayat.close")} className="pressable grid place-items-center w-6 h-6 rounded-full bg-fill-2 text-label-2">
            <X size={13} strokeWidth={2.5} />
          </button>
        )}
      </div>

      <Chips items={MODES} value={value.mode} onChange={mode => set({ mode })} label={t("layer.title")} render={m => t(`layer.${m}`)} />

      {active && (
        <>
          <Chips items={VARIABLES} value={value.variable} onChange={variable => set({ variable })} label={t("layer.variable")} render={v => t(`var.${v}`)} />
          {dates.length > 0 && (
            <Chips items={dates} value={value.date ?? dates[0]} onChange={date => set({ date })} label={t("layer.date")} render={dayName} />
          )}
          {status === "error" ? (
            <p className="text-[12.5px] text-orange-ink">{t("layer.error")}</p>
          ) : scale ? (
            <Legend scale={scale} unit={unit} />
          ) : null}
          <p className="text-[11.5px] leading-[1.4] text-label-2">
            {value.mode === "coarse" ? t("layer.coarseNote") : modelTrained ? t("layer.downscaledNote") : t("layer.baselineNote")}
          </p>
        </>
      )}
    </div>
  );
}
