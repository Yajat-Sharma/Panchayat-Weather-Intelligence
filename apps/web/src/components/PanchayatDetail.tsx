"use client";

import React, { useState } from 'react';
import { ChevronRight, Check, Info, Layers, MapPin, MessagesSquare, RotateCw, X } from 'lucide-react';
import AgriculturalIntelligence from './AgriculturalIntelligence';
import WeatherHero from './WeatherHero';
import ForecastList from './ForecastList';
import DataModel from './DataModel';
import { useLanguage } from '../i18n/LanguageContext';
import type { ForecastDay, HistoricalWeather, PanchayatDetails, PanchayatEntry } from '../lib/api';
import { formatMm, parseDay, rainfallOf } from '../lib/weather';
import { Card, IconButton, SectionLabel, Skeleton, cx } from './ui';

export type Loadable<T> = T | null | 'error';

interface Props {
  gpcode: string;
  entry?: PanchayatEntry;
  details: Loadable<PanchayatDetails>;
  forecast: Loadable<ForecastDay[]>;
  history: HistoricalWeather | null;
  onClose: () => void;
  onRetry: () => void;
  onAskAi: () => void;
  selectedCrop: string | null;
  setSelectedCrop: (crop: string) => void;
  onOpenBlock: (block: string) => void;
}

const CROPS = [
  { id: "Rice", emoji: "🌾" },
  { id: "Soybean", emoji: "🫘" },
  { id: "Maize", emoji: "🌽" },
  { id: "Vegetables", emoji: "🥬" },
  { id: "Sugarcane", emoji: "🎋" },
];

const rise = (i: number) => ({ className: 'animate-rise', style: { '--i': i } as React.CSSProperties });

export default function PanchayatDetail({
  gpcode, entry, details, forecast, history, onClose, onRetry, onAskAi, selectedCrop, setSelectedCrop, onOpenBlock,
}: Props) {
  const { t, locale } = useLanguage();
  const [dayIndex, setDayIndex] = useState(0);

  const d = details && details !== 'error' ? details : null;
  const name = d?.GPNAME || entry?.name;
  const block = d?.blkname || entry?.block;
  const district = d?.dtname || entry?.district;

  const days = Array.isArray(forecast) ? forecast : null;
  const day = days?.[Math.min(dayIndex, (days?.length ?? 1) - 1)];
  const rainfall = rainfallOf(day);
  const heroState = forecast === 'error' ? 'error' : days ? (days.length ? 'ready' : 'error') : 'loading';

  const dayLabel =
    dayIndex === 0 ? t('weather.today')
    : dayIndex === 1 ? t('weather.tomorrow')
    : day ? parseDay(day.date).toLocaleDateString(locale, { weekday: 'long' }) : '';

  if (details === 'error') {
    return (
      <div className="py-16 text-center animate-fade">
        <p className="text-[17px] font-semibold text-label">{t('panchayat.loadError')}</p>
        <div className="flex justify-center gap-2 mt-4">
          <button onClick={onRetry} className="pressable flex items-center gap-1.5 text-[15px] font-semibold text-white bg-accent px-4 py-2 rounded-full">
            <RotateCw size={15} /> {t('sys.retry')}
          </button>
          <button onClick={onClose} className="pressable text-[15px] font-semibold text-accent bg-accent/10 px-4 py-2 rounded-full">
            {t('panchayat.close')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 pt-1 pb-8">
      {/* Identity */}
      <header {...rise(0)} className="animate-rise flex items-start gap-3 px-1">
        <div className="flex-1 min-w-0">
          {name ? (
            <h2 className="text-[28px] leading-[1.1] font-bold tracking-[-0.025em] text-label text-balance">{name}</h2>
          ) : (
            <Skeleton className="h-8 w-48" />
          )}
          <p className="mt-1.5 text-[14px] text-label-2 flex items-center gap-1.5 flex-wrap">
            <MapPin size={13} className="shrink-0" />
            {block && (
              <button
                type="button"
                onClick={() => onOpenBlock(block)}
                className="pressable text-accent font-medium hover:underline underline-offset-2"
                title={t('block.open')}
              >
                {block} {t('panchayat.block')}
              </button>
            )}
            {block && district && <span aria-hidden>·</span>}
            {district && <span>{district} {t('panchayat.district')}</span>}
            {d?.area_sqkm != null && (
              <>
                <span aria-hidden>·</span>
                <span className="tabular flex items-center gap-1"><Layers size={12} />{d.area_sqkm.toFixed(1)} km²</span>
              </>
            )}
          </p>
        </div>
        <IconButton label={t('panchayat.close')} onClick={onClose} variant="fill" className="w-8 h-8 mt-0.5">
          <X size={16} strokeWidth={2.5} />
        </IconButton>
      </header>

      <div {...rise(1)}>
        <WeatherHero day={day} dayIndex={dayIndex} state={heroState} elevation={d?.elevation_mean} />
      </div>

      {forecast !== 'error' && (
        <div {...rise(2)}>
          <ForecastList days={days} selected={dayIndex} onSelect={setDayIndex} />
        </div>
      )}

      {/* Crop */}
      <section {...rise(3)}>
        <SectionLabel>{t('ag.growing')}</SectionLabel>
        <div className="-mx-4 md:-mx-5">
          <div className="flex gap-2 overflow-x-auto hide-scrollbar px-4 md:px-5 scroll-px-4 md:scroll-px-5 pt-0.5 pb-2 snap-x" role="radiogroup" aria-label={t('ag.growing')}>
            {CROPS.map(c => {
              const on = selectedCrop === c.id;
              return (
                <button
                  key={c.id}
                  role="radio"
                  aria-checked={on}
                  onClick={() => setSelectedCrop(c.id)}
                  className={cx(
                    'pressable snap-start shrink-0 flex items-center gap-2 h-10 pl-3 pr-4 rounded-full text-[14.5px] font-medium',
                    on ? 'bg-green text-white shadow-[0_4px_14px_-4px_color-mix(in_oklab,var(--green)_70%,transparent)]' : 'bg-surface text-label shadow-card hover:bg-fill-3'
                  )}
                >
                  <span className="relative w-5 h-5 grid place-items-center text-[17px] leading-none">
                    <span className={cx('transition-all duration-300', on ? 'opacity-0 scale-50' : 'opacity-100')}>{c.emoji}</span>
                    <Check size={16} strokeWidth={3} className={cx('absolute transition-all duration-300 ease-[var(--ease-spring)]', on ? 'opacity-100 scale-100' : 'opacity-0 scale-50')} />
                  </span>
                  {t(`ag.${c.id.toLowerCase()}`)}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {heroState === 'ready' && (
        <div {...rise(4)}>
          <AgriculturalIntelligence gpcode={gpcode} selectedCrop={selectedCrop} dayIndex={dayIndex} dayLabel={dayLabel} />
        </div>
      )}

      {heroState === 'ready' && day && (
        <section {...rise(5)}>
          <SectionLabel icon={Info}>{t('explain.whyEstimate')}</SectionLabel>
          <Card className="p-4">
            <p className="text-[13.5px] text-label-2 mb-3">{t('explain.intro', { name: name ?? '' })}</p>
            <dl className="text-[14.5px]">
              <div className="flex items-center justify-between gap-3 py-2">
                <dt>
                  <div className="text-label">{t('explain.coarse')}</div>
                  <div className="text-[12.5px] text-label-2">{t('explain.coarseNote')}</div>
                </dt>
                <dd className="tabular text-label">{formatMm(day.era5_baseline_input_mm)} mm</dd>
              </div>
              <div className="flex items-center justify-between gap-3 py-2">
                <dt>
                  <div className="text-label">{t('explain.correction')}</div>
                  <div className="text-[12.5px] text-label-2">
                    {d?.elevation_mean != null ? t('explain.correctionNote', { elev: Math.round(d.elevation_mean).toString() }) : 'XGBoost'}
                  </div>
                </dt>
                <dd className={cx('tabular font-medium', day.model_residual_correction_mm >= 0 ? 'text-green-ink' : 'text-orange-ink')}>
                  {day.model_residual_correction_mm >= 0 ? '+' : '−'}{formatMm(Math.abs(day.model_residual_correction_mm), 2)} mm
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3 pt-3 mt-1 border-t border-separator">
                <dt>
                  <div className="font-semibold text-label">{t('explain.final')}</div>
                  <div className="text-[12.5px] text-label-2">{t('explain.finalNote')}</div>
                </dt>
                <dd className="tabular text-[20px] font-semibold tracking-[-0.02em] text-accent-ink">{formatMm(rainfall)} mm</dd>
              </div>
            </dl>
          </Card>
        </section>
      )}

      {/* Copilot entry point */}
      <button
        {...rise(6)}
        onClick={onAskAi}
        className="animate-rise pressable group flex items-center gap-3.5 p-4 rounded-[22px] text-left bg-surface shadow-card hover:bg-fill-3"
        style={{ '--i': 6 } as React.CSSProperties}
      >
        <span className="grid place-items-center w-10 h-10 rounded-[12px] bg-accent/12 text-accent shrink-0">
          <MessagesSquare size={20} />
        </span>
        <span className="flex-1 min-w-0">
          <span className="block text-[16px] font-semibold tracking-[-0.01em] text-label truncate">{t('ai.askAbout', { name: name ?? '' })}</span>
          <span className="block text-[13px] text-label-2">{t('ai.askAboutBody')}</span>
        </span>
        <ChevronRight size={18} className="text-label-3 transition-transform duration-300 group-hover:translate-x-0.5" />
      </button>

      <div {...rise(7)}>
        <DataModel history={history} />
      </div>
    </div>
  );
}
