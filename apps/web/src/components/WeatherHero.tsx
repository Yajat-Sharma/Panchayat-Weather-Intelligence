"use client";

import { Droplets, Grid2x2, Mountain, Umbrella, Wind } from "lucide-react";
import { useLanguage } from "../i18n/LanguageContext";
import type { ForecastDay } from "../lib/api";
import { useAnimatedNumber } from "../lib/hooks";
import { CONDITION_ICON, HERO_GRADIENTS, conditionFor, formatMm, formatVar, parseDay, rainProb, rainRange, rainfallOf, valueOf, type Condition } from "../lib/weather";
import { Skeleton, cx } from "./ui";

interface Props {
  day?: ForecastDay;
  dayIndex: number;
  state: "loading" | "ready" | "error";
  elevation?: number;
}

const CONDITIONS: Condition[] = ["dry", "light", "moderate", "heavy"];

export default function WeatherHero({ day, dayIndex, state, elevation }: Props) {
  const { t, locale } = useLanguage();
  const mm = rainfallOf(day);
  const condition = state === "ready" ? conditionFor(mm) : "light";
  const animated = useAnimatedNumber(mm);
  const Icon = CONDITION_ICON[condition];

  const label =
    dayIndex === 0 ? t("weather.today")
    : dayIndex === 1 ? t("weather.tomorrow")
    : day ? parseDay(day.date).toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "short" })
    : "";

  const correction = day?.model_residual_correction_mm ?? 0;
  const tmax = valueOf(day, "tmax");
  const tmin = valueOf(day, "tmin");
  const range = rainRange(day);
  const prob = rainProb(day);
  const rh = valueOf(day, "rh");
  const wind = valueOf(day, "wind");

  return (
    <section
      className="relative isolate overflow-hidden rounded-[26px] text-white shadow-[0_10px_30px_-12px_rgb(20_40_80/0.45)]"
      aria-live="polite"
    >
      {/* Crossfading atmosphere */}
      {CONDITIONS.map(c => (
        <div
          key={c}
          aria-hidden
          className="absolute inset-0 -z-10 transition-opacity duration-[900ms] ease-[var(--ease-out)]"
          style={{ background: HERO_GRADIENTS[c], opacity: c === condition ? 1 : 0 }}
        />
      ))}
      <div aria-hidden className="absolute inset-0 -z-10 dark:bg-black/15" />
      <div
        aria-hidden
        className={cx("hero-sun absolute -top-16 -right-12 w-56 h-56 rounded-full -z-10 transition-opacity duration-700", condition === "dry" ? "opacity-100" : "opacity-0")}
        style={{ background: "radial-gradient(circle, rgb(255 236 170 / 0.75) 0%, rgb(255 214 120 / 0.25) 38%, transparent 68%)" }}
      />
      <div
        aria-hidden
        className={cx("hero-cloud absolute -top-10 -right-10 w-64 h-40 rounded-full -z-10 blur-2xl transition-opacity duration-700", condition !== "dry" ? "opacity-100" : "opacity-0")}
        style={{ background: "radial-gradient(ellipse, rgb(255 255 255 / 0.28), transparent 70%)" }}
      />
      <div
        aria-hidden
        className="hero-rain absolute inset-0 -z-10 transition-opacity duration-700"
        style={{ opacity: condition === "heavy" ? 0.9 : condition === "moderate" ? 0.55 : condition === "light" ? 0.28 : 0 }}
      />

      <div className="p-5 md:p-6">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[15px] font-semibold tracking-[-0.01em] drop-shadow-sm">{label}</span>
          <span className="flex items-center gap-1 text-[11.5px] font-semibold uppercase tracking-[0.06em] bg-white/18 backdrop-blur-md rounded-full pl-2 pr-2.5 py-1">
            <Grid2x2 size={12} /> {t("weather.downscaled")}
          </span>
        </div>

        {state === "loading" ? (
          <div className="mt-5 mb-1">
            <div className="h-[76px] w-40 rounded-2xl bg-white/15 animate-pulse" />
            <div className="h-5 w-32 rounded-lg bg-white/15 mt-3 animate-pulse" />
            <p className="text-[13.5px] text-white/80 mt-4">{t("weather.loadingForecast")}</p>
          </div>
        ) : state === "error" || !day ? (
          <div className="mt-6 mb-2">
            <p className="text-[20px] font-semibold">{t("sys.operationalUnavailable")}</p>
            <p className="text-[14px] text-white/80 mt-1">{t("weather.unavailable")}</p>
          </div>
        ) : (
          <>
            <div className="flex items-end gap-4 mt-3">
              <div className="flex items-start">
                <span className="text-[84px] md:text-[92px] leading-[0.95] font-extralight tracking-[-0.045em] tabular drop-shadow-sm">
                  {formatMm(animated)}
                </span>
                <span className="text-[22px] font-light text-white/85 mt-3 ml-1">mm</span>
              </div>
              <Icon size={40} strokeWidth={1.5} className="mb-3 ml-auto text-white/95 drop-shadow" />
            </div>
            <p key={condition} className="text-[20px] font-semibold tracking-[-0.015em] mt-1 animate-fade">
              {t(`weather.cond.${condition}`)}
              {tmax != null && tmin != null && (
                <span className="ml-2 text-[16px] font-medium text-white/85 tabular">
                  {t("weather.hiLo", { hi: Math.round(tmax).toString(), lo: Math.round(tmin).toString() })}
                </span>
              )}
            </p>
            {range && (
              <p className="text-[13px] text-white/85 mt-0.5 tabular">
                {t("weather.range", { lo: formatMm(range[0]), hi: formatMm(range[1]) })}
              </p>
            )}
            <p className="text-[14px] leading-snug text-white/85 mt-1 max-w-[34ch] text-pretty">{t(`weather.interp.${condition}`)}</p>

            {(rh != null || wind != null || prob != null) && (
              <div className="grid grid-cols-3 gap-2 mt-4">
                <Stat label={t("weather.rainChance")} value={prob != null ? `${Math.round(prob * 100)}%` : "—"} Icon={Umbrella} />
                <Stat label={t("weather.humidity")} value={formatVar("rh", rh)} Icon={Droplets} />
                <Stat label={t("weather.wind")} value={formatVar("wind", wind)} Icon={Wind} />
              </div>
            )}

            <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-white/20">
              <Stat label={t("weather.coarse")} value={`${formatMm(day.era5_baseline_input_mm)} mm`} />
              <Stat label={t("weather.correction")} value={`${correction > 0 ? "+" : correction < 0 ? "−" : ""}${formatMm(Math.abs(correction), 2)} mm`} />
              <Stat
                label={t("panchayat.elevation")}
                value={elevation != null && Number.isFinite(elevation) ? `${Math.round(elevation)} m` : "—"}
                Icon={Mountain}
              />
            </div>
          </>
        )}
      </div>
    </section>
  );
}

function Stat({ label, value, Icon }: { label: string; value: string; Icon?: typeof Mountain }) {
  return (
    <div className="min-w-0">
      <div className="text-[11px] font-semibold uppercase tracking-[0.05em] text-white/70 truncate flex items-center gap-1">
        {Icon && <Icon size={11} />}{label}
      </div>
      <div className="text-[16px] font-semibold tabular mt-0.5 truncate">{value}</div>
    </div>
  );
}

export function WeatherHeroSkeleton() {
  return <Skeleton className="h-[300px] rounded-[26px]" />;
}
