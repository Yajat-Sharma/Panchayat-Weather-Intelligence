"use client";

import { CalendarDays } from "lucide-react";
import { useLanguage } from "../i18n/LanguageContext";
import type { ForecastDay } from "../lib/api";
import { CONDITION_ICON, conditionFor, formatMm, parseDay, rainProb, rainRange, rainfallOf, valueOf, type Condition } from "../lib/weather";
import { Card, SectionLabel, Skeleton, cx } from "./ui";

const ICON_TINT: Record<Condition, string> = {
  dry: "text-orange",
  light: "text-teal",
  moderate: "text-accent",
  heavy: "text-purple",
};

interface Props {
  days: ForecastDay[] | null;
  selected: number;
  onSelect: (i: number) => void;
}

/**
 * Apple Weather–style daily list. Bars are scaled to the week's wettest day (including the top
 * of the 80% range) so relative wetness reads at a glance; the pale band behind a bar is p10–p90.
 */
export default function ForecastList({ days, selected, onSelect }: Props) {
  const { t, locale } = useLanguage();

  if (!days) {
    return (
      <section>
        <SectionLabel icon={CalendarDays}>{t("weather.outlook7Day")}</SectionLabel>
        <Card className="p-4 flex flex-col gap-4">
          {Array.from({ length: 7 }).map((_, i) => <Skeleton key={i} className="h-6" />)}
        </Card>
      </section>
    );
  }
  if (!days.length) return null;

  const max = Math.max(5, ...days.map(d => Math.max(rainfallOf(d), rainRange(d)?.[1] ?? 0)));
  const hasTemps = days.some(d => valueOf(d, "tmax") != null);
  const pct = (v: number) => `${Math.min(100, Math.max(0, (v / max) * 100))}%`;

  return (
    <section>
      <SectionLabel icon={CalendarDays}>{t("weather.outlook7Day")}</SectionLabel>
      <Card className="p-1.5">
        <ul role="listbox" aria-label={t("weather.outlook7Day")}>
          {days.map((d, i) => {
            const mm = rainfallOf(d);
            const c = conditionFor(mm);
            const Icon = CONDITION_ICON[c];
            const isSel = i === selected;
            const range = rainRange(d);
            const prob = rainProb(d);
            const tmax = valueOf(d, "tmax");
            const tmin = valueOf(d, "tmin");
            const name = i === 0 ? t("weather.today") : parseDay(d.date).toLocaleDateString(locale, { weekday: "short" });
            return (
              <li key={d.date} role="option" aria-selected={isSel}>
                <button
                  type="button"
                  onClick={() => onSelect(i)}
                  className={cx(
                    "pressable relative w-full grid items-center gap-3 px-3 h-[50px] rounded-[14px] text-left",
                    hasTemps ? "grid-cols-[3.6rem_1.75rem_1fr_3.4rem_3.6rem]" : "grid-cols-[4.2rem_1.75rem_1fr_3.6rem]",
                    isSel ? "bg-accent/10" : "hover:bg-fill-3"
                  )}
                >
                  <span className={cx("text-[15px] truncate", isSel ? "font-semibold text-accent-ink" : "font-medium text-label")}>{name}</span>
                  <span className="flex flex-col items-center leading-none">
                    <Icon size={20} className={ICON_TINT[c]} strokeWidth={1.9} />
                    {prob != null && prob >= 0.2 && (
                      <span className="text-[10.5px] font-semibold text-teal tabular mt-0.5">{Math.round(prob * 100)}%</span>
                    )}
                  </span>
                  <span className="relative h-[5px] rounded-full bg-fill overflow-hidden">
                    {range && (
                      <span
                        aria-hidden
                        className="absolute inset-y-0 rounded-full bg-accent/25"
                        style={{ left: pct(range[0]), width: `calc(${pct(range[1])} - ${pct(range[0])})` }}
                        title={`${formatMm(range[0])}–${formatMm(range[1])} mm`}
                      />
                    )}
                    <span
                      className="absolute inset-y-0 left-0 rounded-full origin-left transition-[width] duration-700 ease-[var(--ease-out)]"
                      style={{
                        width: `${mm <= 0.05 ? 0 : Math.max(6, (mm / max) * 100)}%`,
                        background: "linear-gradient(90deg, var(--teal), var(--accent) 55%, var(--purple))",
                        backgroundSize: `${(100 / Math.max(0.06, mm / max)).toFixed(0)}% 100%`,
                      }}
                    />
                  </span>
                  {hasTemps && (
                    <span className="text-[13.5px] text-right tabular whitespace-nowrap">
                      <span className="text-label">{tmax != null ? `${Math.round(tmax)}°` : "—"}</span>
                      <span className="text-label-2 ml-1">{tmin != null ? `${Math.round(tmin)}°` : ""}</span>
                    </span>
                  )}
                  <span className="text-[15px] text-right tabular">
                    <span className={cx(isSel ? "font-semibold text-label" : "text-label")}>{formatMm(mm, mm >= 10 ? 0 : 1)}</span>
                    <span className="text-[12px] text-label-2 ml-0.5">mm</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </Card>
      <p className="text-[12px] leading-[1.45] text-label-3 mt-2.5 px-1">{t("weather.caveat")}</p>
    </section>
  );
}
