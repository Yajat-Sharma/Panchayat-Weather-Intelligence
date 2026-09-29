"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Database, FlaskConical } from "lucide-react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useLanguage } from "../i18n/LanguageContext";
import { api, VARIABLES, type HistoricalWeather, type MetricsResponse } from "../lib/api";
import { parseDay } from "../lib/weather";
import { Card, Collapse, DisclosureButton } from "./ui";

// Validated categorical slots (blue / orange / aqua) — see dataviz palette check.
const SERIES = {
  light: { xgb: "#2a78d6", chirps: "#eb6834", era5: "#1baf7a", grid: "rgb(60 60 67 / 0.1)", tick: "rgb(60 60 67 / 0.6)" },
  dark: { xgb: "#3987e5", chirps: "#d95926", era5: "#199e70", grid: "rgb(235 235 245 / 0.1)", tick: "rgb(235 235 245 / 0.55)" },
};

function Metric({ value, label, sub }: { value: string; label: string; sub: string }) {
  return (
    <div className="rounded-[16px] bg-fill-3 p-3.5">
      <div className="text-[11.5px] font-semibold uppercase tracking-[0.05em] text-label-2">{label}</div>
      <div className="text-[28px] font-semibold tracking-[-0.03em] text-label tabular leading-tight mt-1">{value}</div>
      <div className="text-[12.5px] text-green-ink font-medium">{sub}</div>
    </div>
  );
}

export default function DataModel({ history }: { history: HistoricalWeather | null }) {
  const { t, locale } = useLanguage();
  const { resolvedTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const [metrics, setMetrics] = useState<MetricsResponse | null | "error">(null);
  const c = SERIES[resolvedTheme === "dark" ? "dark" : "light"];

  // Fetch once the section is opened; numbers come from data/models/metrics.json, never hard-coded.
  useEffect(() => {
    if (!open || metrics) return;
    const ctrl = new AbortController();
    api.metrics(ctrl.signal).then(setMetrics).catch(() => !ctrl.signal.aborted && setMetrics("error"));
    return () => ctrl.abort();
  }, [open, metrics]);

  const vm = metrics && metrics !== "error" ? metrics.metrics.variables ?? {} : {};
  const rain = vm.rainfall;
  const pct = (x?: number | null) => (x == null ? "—" : `${x.toFixed(2)}%`);
  const num = (x?: number | null) => (x == null ? "—" : x.toFixed(x >= 10 ? 1 : 2));

  const series = [
    { key: "downscaled_rainfall_mm", name: t("data.seriesXgb"), color: c.xgb, width: 2 },
    { key: "target_rainfall_mm", name: t("data.seriesChirps"), color: c.chirps, width: 1.5 },
    { key: "era5_rainfall_mm", name: t("data.seriesEra5"), color: c.era5, width: 1.5 },
  ];

  const fmtDate = (d: string) => parseDay(d).toLocaleDateString(locale, { day: "numeric", month: "short" });
  const ts = history?.status === "AVAILABLE" ? history.timeseries ?? [] : [];

  return (
    <Card className="px-4 py-3">
      <DisclosureButton open={open} onClick={() => setOpen(o => !o)} icon={Database} controls="data-model">
        {t("nav.dataModel")}
      </DisclosureButton>

      <Collapse open={open} id="data-model">
        <div className="pt-4 pb-2 flex flex-col gap-6">
          <div>
            <h4 className="text-[15px] font-semibold text-label flex items-center gap-2">
              <FlaskConical size={15} className="text-label-2" /> {t("data.validationTitle")}
            </h4>
            <p className="text-[13.5px] leading-[1.5] text-label-2 mt-1.5 text-pretty">{t("data.validationBody")}</p>
            {metrics === "error" ? (
              <p className="text-[13px] text-label-2 mt-3">{t("data.metricsUnavailable")}</p>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-2.5 mt-3.5">
                  <Metric value={pct(rain?.point.rmse_reduction_percent)} label={t("data.spatialBlock")} sub={t("data.rmseReduction")} />
                  {rain?.random_holdout ? (
                    <Metric value={pct(rain.random_holdout.rmse_reduction_percent)} label={t("data.randomHoldout")} sub={t("data.rmseReduction")} />
                  ) : (
                    <Metric value={pct(rain?.block_input?.rmse_reduction_percent)} label={t("data.blockInput")} sub={t("data.rmseReduction")} />
                  )}
                </div>
                <div className="mt-3 rounded-[14px] bg-fill-3 overflow-x-auto">
                  <table className="w-full text-[12.5px] tabular">
                    <caption className="sr-only">{t("data.perVariable")}</caption>
                    <thead className="text-label-2 text-left">
                      <tr>
                        <th className="font-semibold px-3 py-2">{t("data.variable")}</th>
                        <th className="font-semibold px-2 py-2 text-right">{t("data.rmseCol")}</th>
                        <th className="font-semibold px-2 py-2 text-right">{t("data.gain")}</th>
                        <th className="font-semibold px-3 py-2 text-right">{t("data.coverage")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {VARIABLES.map(v => {
                        const m = vm[v];
                        return (
                          <tr key={v} className="border-t border-separator">
                            <td className="px-3 py-2 text-label">{t(`var.${v}`)}<div className="text-[11px] text-label-3">{m?.reference ?? t("data.notTrained")}</div></td>
                            <td className="px-2 py-2 text-right text-label whitespace-nowrap">{m ? `${num(m.point.baseline_rmse)} → ${num(m.point.model_rmse)}` : "—"}</td>
                            <td className="px-2 py-2 text-right text-green-ink font-medium">{m ? pct(m.point.rmse_reduction_percent) : "—"}</td>
                            <td className="px-3 py-2 text-right text-label">{m?.interval ? `${Math.round(m.interval.coverage * 100)}%` : "—"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <p className="text-[11.5px] leading-[1.45] text-label-3 mt-2">{t("data.metricsNote")}</p>
              </>
            )}
          </div>

          {ts.length > 0 && (
            <figure>
              <figcaption className="text-[15px] font-semibold text-label">{t("data.historicalTitle")}</figcaption>
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 mb-3" role="list">
                {series.map(s => (
                  <span key={s.key} role="listitem" className="flex items-center gap-1.5 text-[12.5px] text-label-2">
                    <span className="w-3 h-[3px] rounded-full" style={{ background: s.color }} />
                    {s.name}
                  </span>
                ))}
              </div>
              <div className="h-[210px] -ml-2">
                {open && (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={ts} margin={{ top: 4, right: 18, bottom: 0, left: 0 }}>
                      <CartesianGrid vertical={false} stroke={c.grid} />
                      <XAxis dataKey="date" tickFormatter={fmtDate} tick={{ fontSize: 11, fill: c.tick }} tickLine={false} axisLine={false} minTickGap={40} dy={6} />
                      <YAxis tick={{ fontSize: 11, fill: c.tick }} tickLine={false} axisLine={false} width={34} unit="" />
                      <Tooltip
                        cursor={{ stroke: c.tick, strokeWidth: 1, strokeDasharray: "3 3" }}
                        content={({ active, payload, label }) =>
                          active && payload?.length ? (
                            <div className="glass-strong rounded-[12px] shadow-float px-3 py-2 text-[12px] min-w-[150px]">
                              <div className="font-semibold text-label mb-1">{fmtDate(String(label))}</div>
                              {series.map(s => {
                                const p = payload.find(x => x.dataKey === s.key);
                                return (
                                  <div key={s.key} className="flex items-center gap-2 text-label-2">
                                    <span className="w-2 h-2 rounded-full" style={{ background: s.color }} />
                                    <span className="flex-1">{s.name}</span>
                                    <span className="text-label tabular font-medium">{p ? Number(p.value).toFixed(1) : "—"} mm</span>
                                  </div>
                                );
                              })}
                            </div>
                          ) : null
                        }
                      />
                      {[...series].reverse().map(s => (
                        <Line
                          key={s.key}
                          type="monotone"
                          dataKey={s.key}
                          name={s.name}
                          stroke={s.color}
                          strokeWidth={s.width}
                          dot={false}
                          activeDot={{ r: 4, strokeWidth: 2, stroke: resolvedTheme === "dark" ? "#1c1c1e" : "#fff" }}
                          isAnimationActive
                          animationDuration={900}
                        />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </figure>
          )}

          <div>
            <h4 className="text-[15px] font-semibold text-label">{t("data.sources")}</h4>
            <ul className="mt-2 rounded-[14px] bg-fill-3 overflow-hidden">
              {[
                ["ERA5 & ECMWF", t("data.srcEra5")],
                ["Copernicus DEM", t("data.srcDem")],
                ["Gram Manchitra", t("data.srcGm")],
                ["CHIRPS v2.0", t("data.srcChirps")],
                ["ERA5-Land", t("data.srcEra5Land")],
                ["ESA WorldCover 2021", t("data.srcWorldCover")],
              ].map(([name, desc], i) => (
                <li key={name} className={`px-3.5 py-2.5 ${i > 0 ? "border-t border-separator" : ""}`}>
                  <div className="text-[14px] font-medium text-label">{name}</div>
                  <div className="text-[12.5px] text-label-2">{desc}</div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Collapse>
    </Card>
  );
}
