"use client";

import React, { useEffect, useState } from "react";
import { ArrowLeft, Boxes, ChevronRight, ClipboardEdit, RotateCw, X } from "lucide-react";
import { useLanguage } from "../i18n/LanguageContext";
import { api, VARIABLES, type BlockForecast, type BlockInputDay, type VarKey } from "../lib/api";
import { formatVar, parseDay } from "../lib/weather";
import { Card, IconButton, SectionLabel, Skeleton, cx } from "./ui";

interface Props {
  block: string;
  onClose: () => void;
  onBack?: () => void;
  onSelectPanchayat: (gp: string) => void;
}

const COLLAPSED_ROWS = 12;
const LIMITS: Record<VarKey, { min: number; max: number; step: number }> = {
  rainfall: { min: 0, max: 500, step: 0.1 },
  tmax: { min: -20, max: 60, step: 0.1 },
  tmin: { min: -20, max: 60, step: 0.1 },
  rh: { min: 0, max: 100, step: 1 },
  wind: { min: 0, max: 300, step: 0.1 },
};

const tomorrowIso = () => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/** Ranked strip: each Panchayat's downscaled value as a bar, with the block value as a reference line. */
function RankedStrip({ rows, blockValue, variable, onSelect }: {
  rows: { gpcode: string; name?: string; value: number }[];
  blockValue: number | null;
  variable: VarKey;
  onSelect: (gp: string) => void;
}) {
  const { t } = useLanguage();
  const [all, setAll] = useState(false);
  const vals = rows.map(r => r.value).concat(blockValue != null ? [blockValue] : []);
  const lo = variable === "rainfall" ? 0 : Math.min(...vals);
  const hi = Math.max(...vals, lo + 1e-6);
  const pad = variable === "rainfall" ? 0 : (hi - lo) * 0.1;
  const x = (v: number) => `${((v - (lo - pad)) / (hi + pad - (lo - pad))) * 100}%`;
  const shown = all ? rows : rows.slice(0, COLLAPSED_ROWS);

  return (
    <Card className="p-1.5">
      <ul>
        {shown.map((r, i) => (
          <li key={r.gpcode}>
            <button
              type="button"
              onClick={() => onSelect(r.gpcode)}
              className="pressable w-full grid grid-cols-[1.4rem_minmax(0,7.5rem)_1fr_3.8rem] items-center gap-2 px-2.5 h-9 rounded-[12px] text-left hover:bg-fill-3"
              title={`${r.name ?? r.gpcode}: ${formatVar(variable, r.value)}`}
            >
              <span className="text-[11.5px] text-label-3 tabular text-right">{i + 1}</span>
              <span className="text-[13.5px] text-label truncate">{r.name ?? r.gpcode}</span>
              <span className="relative h-[6px] rounded-full bg-fill">
                <span className="absolute inset-y-0 left-0 rounded-full bg-accent" style={{ width: x(r.value) }} />
                {blockValue != null && (
                  <span aria-hidden className="absolute -top-1.5 -bottom-1.5 w-[2px] rounded-full bg-label" style={{ left: x(blockValue) }} />
                )}
              </span>
              <span className="text-[13px] text-label tabular text-right">{formatVar(variable, r.value)}</span>
            </button>
          </li>
        ))}
      </ul>
      {rows.length > COLLAPSED_ROWS && (
        <button onClick={() => setAll(a => !a)} className="pressable w-full h-9 text-[14px] font-medium text-accent">
          {all ? t("block.showLess") : t("block.showAll", { n: String(rows.length) })}
        </button>
      )}
    </Card>
  );
}

function CustomForecastForm({ block, onResult, onCancel }: { block: string; onResult: (f: BlockForecast) => void; onCancel: () => void }) {
  const { t } = useLanguage();
  const [date, setDate] = useState(tomorrowIso);
  const [vals, setVals] = useState<Partial<Record<VarKey, string>>>({ rainfall: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const day: BlockInputDay = { date };
    for (const v of VARIABLES) {
      const s = vals[v]?.trim();
      if (s) day[v] = Number(s);
    }
    if (VARIABLES.every(v => day[v] == null)) {
      setError(t("block.needValue"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      onResult(await api.blockDownscale(block, [day]));
    } catch {
      setError(t("block.submitError"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="p-4">
      <form onSubmit={submit} className="flex flex-col gap-3">
        <p className="text-[13.5px] text-label-2 text-pretty">{t("block.customIntro")}</p>
        <label className="flex items-center justify-between gap-3 text-[14.5px] text-label">
          {t("block.date")}
          <input
            type="date"
            required
            value={date}
            onChange={e => setDate(e.target.value)}
            className="h-9 px-2.5 rounded-[10px] bg-fill-2 text-label tabular"
          />
        </label>
        {VARIABLES.map(v => (
          <label key={v} className="flex items-center justify-between gap-3 text-[14.5px] text-label">
            <span>{t(`var.${v}`)} <span className="text-label-2 text-[12.5px]">({t(`unit.${v}`)})</span></span>
            <input
              type="number"
              inputMode="decimal"
              min={LIMITS[v].min}
              max={LIMITS[v].max}
              step={LIMITS[v].step}
              value={vals[v] ?? ""}
              placeholder="—"
              onChange={e => setVals(s => ({ ...s, [v]: e.target.value }))}
              className="h-9 w-24 px-2.5 rounded-[10px] bg-fill-2 text-label text-right tabular"
            />
          </label>
        ))}
        {error && <p role="alert" className="text-[13px] text-orange-ink">{error}</p>}
        <div className="flex gap-2 justify-end pt-1">
          <button type="button" onClick={onCancel} className="pressable h-9 px-4 rounded-full text-[14.5px] font-semibold text-accent bg-accent/10">
            {t("block.cancel")}
          </button>
          <button type="submit" disabled={busy} className="pressable h-9 px-4 rounded-full text-[14.5px] font-semibold text-white bg-accent disabled:opacity-60">
            {busy ? t("sys.loading") : t("block.downscale")}
          </button>
        </div>
      </form>
    </Card>
  );
}

export default function BlockDetail({ block, onClose, onBack, onSelectPanchayat }: Props) {
  const { t, locale } = useLanguage();
  const [liveResult, setLiveResult] = useState<{ key: string; data: BlockForecast | "error" } | null>(null);
  const [custom, setCustom] = useState<BlockForecast | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [reload, setReload] = useState(0);
  const [variable, setVariable] = useState<VarKey>("rainfall");
  const [dayIndex, setDayIndex] = useState(0);

  const key = `${block}|${reload}`;
  const live = liveResult?.key === key ? liveResult.data : null;

  useEffect(() => {
    const ctrl = new AbortController();
    api.blockForecast(block, ctrl.signal)
      .then(f => !ctrl.signal.aborted && setLiveResult({ key, data: f }))
      .catch(() => !ctrl.signal.aborted && setLiveResult({ key, data: "error" }));
    return () => ctrl.abort();
  }, [block, key]);

  const data = custom ?? (live && live !== "error" ? live : null);
  const day = data?.days[Math.min(dayIndex, data.days.length - 1)];
  const available = VARIABLES.filter(v => day?.block_value[v] != null);
  const activeVar = available.includes(variable) ? variable : available[0] ?? "rainfall";

  const rows = (day?.panchayats ?? [])
    .map(p => ({ gpcode: p.gpcode, name: p.name, value: p[activeVar]?.value ?? null }))
    .filter((r): r is { gpcode: string; name: string | undefined; value: number } => r.value != null)
    .sort((a, b) => b.value - a.value);

  const blockValue = day?.block_value[activeVar] ?? null;
  const spread = day?.spread[activeVar];
  const name = data?.block ?? block;

  return (
    <div className="flex flex-col gap-6 pt-1 pb-8">
      <header className="animate-rise flex items-start gap-3 px-1">
        {onBack && (
          <IconButton label={t("block.back")} onClick={onBack} variant="fill" className="w-8 h-8 mt-0.5">
            <ArrowLeft size={16} strokeWidth={2.5} />
          </IconButton>
        )}
        <div className="flex-1 min-w-0">
          <h2 className="text-[28px] leading-[1.1] font-bold tracking-[-0.025em] text-label text-balance">
            {name} <span className="text-label-2 font-semibold">{t("panchayat.block")}</span>
          </h2>
          <p className="mt-1.5 text-[14px] text-label-2 flex items-center gap-1.5">
            <Boxes size={13} />
            {data ? t("block.subtitle", { n: String(data.panchayat_count), district: data.district ?? "" }) : t("sys.loading")}
          </p>
        </div>
        <IconButton label={t("panchayat.close")} onClick={onClose} variant="fill" className="w-8 h-8 mt-0.5">
          <X size={16} strokeWidth={2.5} />
        </IconButton>
      </header>

      <p className="text-[13.5px] leading-[1.5] text-label-2 px-1 -mt-3 text-pretty">{t("block.intro")}</p>

      {live === "error" && !custom ? (
        <Card className="p-4 flex items-center justify-between gap-3">
          <p className="text-[14px] text-label-2">{t("block.loadError")}</p>
          <button onClick={() => setReload(n => n + 1)} className="pressable flex items-center gap-1.5 text-[14px] font-semibold text-accent">
            <RotateCw size={14} /> {t("sys.retry")}
          </button>
        </Card>
      ) : !data || !day ? (
        <div className="flex flex-col gap-3"><Skeleton className="h-28" /><Skeleton className="h-64" /></div>
      ) : (
        <>
          {custom && (
            <div className="flex items-center justify-between gap-3 rounded-[16px] bg-accent/10 px-4 py-2.5">
              <span className="text-[13.5px] text-accent-ink font-medium">{t("block.customActive")}</span>
              <button onClick={() => { setCustom(null); setDayIndex(0); }} className="pressable text-[13.5px] font-semibold text-accent">
                {t("block.backToLive")}
              </button>
            </div>
          )}

          <div className="flex flex-col gap-2">
            <div role="radiogroup" aria-label={t("layer.variable")} className="flex gap-1.5 overflow-x-auto hide-scrollbar">
              {available.map(v => (
                <button key={v} role="radio" aria-checked={activeVar === v} onClick={() => setVariable(v)}
                  className={cx("pressable shrink-0 h-8 px-3 rounded-full text-[13.5px] font-semibold",
                    activeVar === v ? "bg-accent text-white" : "bg-surface shadow-card text-label")}>
                  {t(`var.${v}`)}
                </button>
              ))}
            </div>
            {data.days.length > 1 && (
              <div role="radiogroup" aria-label={t("layer.date")} className="flex gap-1.5 overflow-x-auto hide-scrollbar">
                {data.days.map((d, i) => (
                  <button key={d.date} role="radio" aria-checked={i === dayIndex} onClick={() => setDayIndex(i)}
                    className={cx("pressable shrink-0 h-7 px-2.5 rounded-full text-[12.5px] font-semibold",
                      i === dayIndex ? "bg-label text-bg" : "bg-fill-2 text-label-2")}>
                    {i === 0 && !custom ? t("weather.today") : parseDay(d.date).toLocaleDateString(locale, { weekday: "short", day: "numeric" })}
                  </button>
                ))}
              </div>
            )}
          </div>

          <Card className="p-4 grid grid-cols-3 gap-3">
            <div className="col-span-3 sm:col-span-1">
              <div className="text-[11px] font-semibold uppercase tracking-[0.05em] text-label-2">{t("block.blockValue")}</div>
              <div className="text-[26px] font-semibold tracking-[-0.02em] tabular text-label">{formatVar(activeVar, blockValue)}</div>
            </div>
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.05em] text-label-2">{t("block.range")}</div>
              <div className="text-[15px] font-semibold tabular text-label mt-1">
                {spread ? `${formatVar(activeVar, spread.min)} – ${formatVar(activeVar, spread.max)}` : "—"}
              </div>
            </div>
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.05em] text-label-2">{t("block.std")}</div>
              <div className="text-[15px] font-semibold tabular text-label mt-1">{spread ? `± ${spread.std.toFixed(spread.std >= 10 ? 0 : 1)}` : "—"}</div>
            </div>
          </Card>

          <section>
            <SectionLabel trailing={<span className="flex items-center gap-1.5 text-[11.5px] text-label-2"><span className="w-[2px] h-3 rounded-full bg-label" />{t("block.blockValue")}</span>}>
              {t("block.ranked")}
            </SectionLabel>
            <RankedStrip rows={rows} blockValue={blockValue} variable={activeVar} onSelect={onSelectPanchayat} />
          </section>
        </>
      )}

      <section>
        <SectionLabel icon={ClipboardEdit}>{t("block.customTitle")}</SectionLabel>
        {formOpen ? (
          <CustomForecastForm
            block={block}
            onCancel={() => setFormOpen(false)}
            onResult={f => { setCustom(f); setDayIndex(0); setFormOpen(false); }}
          />
        ) : (
          <button onClick={() => setFormOpen(true)} className="pressable w-full flex items-center gap-3 p-4 rounded-[22px] bg-surface shadow-card text-left">
            <span className="flex-1 text-[15px] font-medium text-label">{t("block.customCta")}</span>
            <ChevronRight size={18} className="text-label-3" />
          </button>
        )}
      </section>
    </div>
  );
}
