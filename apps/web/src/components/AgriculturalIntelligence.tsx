"use client";

import React, { useEffect, useState } from 'react';
import { Bug, Droplet, Info, RotateCw, SprayCan, Sprout, Thermometer, Tractor, type LucideIcon } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';
import { api, type Advisory, type AdvisoryItem, type AdvisoryTone } from '../lib/api';
import { Card, Collapse, DisclosureButton, SectionLabel, Skeleton, cx } from './ui';

interface Props {
  gpcode: string;
  selectedCrop: string | null;
  dayIndex: number;
  dayLabel: string;
}

const TONE: Record<AdvisoryTone, string> = {
  good: 'text-green-ink bg-green/14',
  caution: 'text-orange-ink bg-orange/16',
  neutral: 'text-label-2 bg-fill-2',
};

const ROW: Record<AdvisoryItem['id'], { icon: LucideIcon; tint: string }> = {
  irrigation: { icon: Droplet, tint: 'text-accent bg-accent/12' },
  spraying: { icon: SprayCan, tint: 'text-teal bg-teal/14' },
  heat: { icon: Thermometer, tint: 'text-red bg-red/12' },
  pest: { icon: Bug, tint: 'text-purple-ink bg-purple/14' },
  field: { icon: Tractor, tint: 'text-orange-ink bg-orange/14' },
};

/** Backend params are numbers; the UI formats them and renders the reason code in the current language. */
const fmtParams = (p: AdvisoryItem['params'], t: (k: string, v?: Record<string, string>) => string) => {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(p)) {
    if (v == null) continue;
    out[k] = k === 'dayOffset'
      ? (v === 0 ? t('weather.today') : v === 1 ? t('weather.tomorrow') : t('adv.inDays', { n: String(v) }))
      : String(Math.round(v * 10) / 10);
  }
  return out;
};

function Row({ item, first }: { item: AdvisoryItem; first?: boolean }) {
  const { t } = useLanguage();
  const { icon: Icon, tint } = ROW[item.id];
  return (
    <li className="flex gap-3 pl-4">
      <span className={cx('grid place-items-center w-8 h-8 rounded-[9px] shrink-0 mt-3', tint)}>
        <Icon size={16} />
      </span>
      <div className={cx('flex-1 min-w-0 py-3 pr-4', !first && 'border-t border-separator')}>
        <div className="flex items-center justify-between gap-3">
          <span className="text-[15px] font-medium text-label">{t(`adv.title.${item.id}`)}</span>
          <span key={item.status} className={cx('text-[12.5px] font-semibold px-2 py-0.5 rounded-full animate-fade whitespace-nowrap', TONE[item.tone])}>
            {t(`adv.status.${item.status}`)}
          </span>
        </div>
        <p className="text-[13.5px] leading-[1.45] text-label-2 mt-1 text-pretty">{t(`adv.${item.code}`, fmtParams(item.params, t))}</p>
      </div>
    </li>
  );
}

export default function AgriculturalIntelligence({ gpcode, selectedCrop, dayIndex, dayLabel }: Props) {
  const { t } = useLanguage();
  const [showDetails, setShowDetails] = useState(false);
  const [reload, setReload] = useState(0);
  // Results are keyed by request, so a stale key simply reads as "loading".
  const key = `${gpcode}|${selectedCrop}|${dayIndex}|${reload}`;
  const [result, setResult] = useState<{ key: string; data: Advisory | 'error' } | null>(null);
  const advisory = result?.key === key ? result.data : null;

  useEffect(() => {
    const ctrl = new AbortController();
    api.advisory(gpcode, selectedCrop, dayIndex, ctrl.signal)
      .then(a => !ctrl.signal.aborted && setResult({ key, data: a }))
      .catch(() => !ctrl.signal.aborted && setResult({ key, data: 'error' }));
    return () => ctrl.abort();
  }, [gpcode, selectedCrop, dayIndex, key]);

  const cropName = selectedCrop ? t(`ag.${selectedCrop.toLowerCase()}`) : t('ag.generic');
  const items = advisory && advisory !== 'error' ? advisory.items : null;

  return (
    <section>
      <SectionLabel icon={Sprout} trailing={<span className="text-[12px] text-label-2">{t('ag.forDay', { day: dayLabel })}</span>}>
        {t('ag.advisory')}
      </SectionLabel>

      <Card className="overflow-hidden">
        {advisory === 'error' ? (
          <div className="p-4 flex items-center justify-between gap-3">
            <p className="text-[14px] text-label-2">{t('adv.unavailable')}</p>
            <button onClick={() => setReload(n => n + 1)} className="pressable flex items-center gap-1.5 text-[14px] font-semibold text-accent">
              <RotateCw size={14} /> {t('sys.retry')}
            </button>
          </div>
        ) : !items ? (
          <div className="p-4 flex flex-col gap-4" aria-busy>
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10" />)}
          </div>
        ) : (
          <ul>
            {items.map((it, i) => <Row key={it.id} item={it} first={i === 0} />)}
          </ul>
        )}

        <div className="border-t border-separator px-4 py-2.5">
          <DisclosureButton open={showDetails} onClick={() => setShowDetails(s => !s)} controls="advisory-why" className="py-1">
            <span className="text-accent text-[15px]">{showDetails ? t('ag.hideDetails') : t('ag.viewDetails')}</span>
          </DisclosureButton>
          <Collapse open={showDetails} id="advisory-why">
            <dl className="pt-2 pb-2 flex flex-col gap-3.5 text-[13.5px] leading-[1.5]">
              <div>
                <dt className="font-semibold text-label">{t('ag.why')}</dt>
                <dd className="text-label-2 mt-0.5">{t('adv.howItWorks')}</dd>
              </div>
              <div>
                <dt className="font-semibold text-label">{t('ag.crop')}</dt>
                <dd className="text-label-2 mt-0.5">{selectedCrop ? t('ag.tailoredFor', { crop: cropName }) : t('ag.selectCrop')}</dd>
              </div>
              <div>
                <dt className="font-semibold text-label">{t('ag.dataUsed')}</dt>
                <dd className="text-label-2 mt-0.5">
                  {t('adv.dataUsed', { days: String(advisory && advisory !== 'error' ? advisory.window_days ?? 0 : 0), crop: cropName })}
                </dd>
              </div>
            </dl>
          </Collapse>
        </div>
      </Card>

      <p className="flex gap-1.5 items-start text-[12px] leading-[1.45] text-label-3 mt-2.5 px-1">
        <Info size={13} className="shrink-0 mt-[1px]" />
        {t('sys.decisionSupport')}
      </p>
    </section>
  );
}
