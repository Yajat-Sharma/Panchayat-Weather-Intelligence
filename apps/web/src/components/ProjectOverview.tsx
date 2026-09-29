"use client";

import { Cloud, Cpu, MousePointerClick, RotateCw, Sprout, WifiOff } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';
import type { SystemStatus } from '../lib/api';
import { Card, SectionLabel, Skeleton } from './ui';

interface Props {
  status: SystemStatus | null | 'error';
  panchayatCount: number | null;
  onRetry: () => void;
}

const STEPS = [
  { icon: Cloud, key: 'step1', tint: 'text-teal bg-teal/14' },
  { icon: Cpu, key: 'step2', tint: 'text-accent bg-accent/12' },
  { icon: Sprout, key: 'step3', tint: 'text-green-ink bg-green/14' },
] as const;

const isHealthy = (v: string) => !/not|blocked|fail|missing|unavailable/i.test(v);

export default function ProjectOverview({ status, panchayatCount, onRetry }: Props) {
  const { t, locale } = useLanguage();

  return (
    <div className="flex flex-col gap-6 pt-2 pb-6">
      <header className="px-1 animate-rise" style={{ '--i': 0 } as React.CSSProperties}>
        <p className="text-[12.5px] font-semibold text-accent tracking-[-0.005em] mb-2 min-h-[18px]">
          {panchayatCount != null && t('overview.eyebrow', { count: panchayatCount.toLocaleString(locale) })}
        </p>
        <h1 className="text-[28px] md:text-[30px] leading-[1.1] font-bold tracking-[-0.025em] text-label text-balance">
          {t('overview.title')}
        </h1>
        <p className="mt-3 text-[15px] leading-[1.5] text-label-2 text-pretty">
          {t('overview.description')}
        </p>
      </header>

      <div className="flex items-center gap-3 rounded-[16px] bg-accent/10 px-4 py-3 text-[14px] text-accent-ink font-medium animate-rise" style={{ '--i': 1 } as React.CSSProperties}>
        <MousePointerClick size={18} className="shrink-0" />
        {t('overview.getStarted')}
      </div>

      <section className="animate-rise" style={{ '--i': 2 } as React.CSSProperties}>
        <SectionLabel>{t('overview.howItWorks')}</SectionLabel>
        <Card className="p-1.5">
          <ol className="relative">
            {STEPS.map(({ icon: Icon, key, tint }, i) => (
              <li key={key} className="relative flex gap-3.5 p-3">
                {i < STEPS.length - 1 && (
                  <span aria-hidden className="absolute left-[29px] top-[50px] bottom-[-6px] w-px bg-separator" />
                )}
                <span className={`relative grid place-items-center w-9 h-9 rounded-[11px] shrink-0 ${tint}`}>
                  <Icon size={18} />
                </span>
                <div className="pt-0.5">
                  <div className="text-[15px] font-semibold text-label tracking-[-0.01em]">{t(`overview.${key}Title`)}</div>
                  <p className="text-[13.5px] leading-[1.45] text-label-2 mt-0.5">{t(`overview.${key}Body`)}</p>
                </div>
              </li>
            ))}
          </ol>
        </Card>
      </section>

      <section className="animate-rise" style={{ '--i': 3 } as React.CSSProperties}>
        <SectionLabel>{t('overview.systemStatus')}</SectionLabel>
        <Card className="overflow-hidden">
          {status === 'error' ? (
            <div className="flex items-center gap-3 p-4">
              <span className="grid place-items-center w-9 h-9 rounded-full bg-red/12 text-red shrink-0"><WifiOff size={17} /></span>
              <p className="flex-1 text-[14px] text-label-2">{t('overview.offline')}</p>
              <button onClick={onRetry} className="pressable flex items-center gap-1.5 text-[14px] font-semibold text-accent px-3 py-1.5 rounded-full bg-accent/10">
                <RotateCw size={14} /> {t('sys.retry')}
              </button>
            </div>
          ) : !status ? (
            <div className="p-4 flex flex-col gap-3.5">
              {[70, 55, 62, 48].map((w, i) => <Skeleton key={i} className="h-4" style={{ width: `${w}%` }} />)}
            </div>
          ) : (
            <ul>
              {Object.entries(status).map(([k, v], i) => (
                <li key={k} className="flex items-center gap-3 pl-4">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${isHealthy(v) ? 'bg-green shadow-[0_0_0_3px_color-mix(in_oklab,var(--green)_20%,transparent)]' : 'bg-orange'}`} />
                  <div className={`flex-1 min-w-0 flex items-baseline justify-between gap-3 py-3 pr-4 ${i > 0 ? 'border-t border-separator' : ''}`}>
                    <span className="text-[14px] text-label shrink-0">{t(`status.${k}`)}</span>
                    <span className="text-[12.5px] text-label-2 truncate text-right" title={v}>{v}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </section>

      <p className="text-center text-[11.5px] text-label-3 px-4 animate-rise" style={{ '--i': 4 } as React.CSSProperties}>
        {t('sys.prototype')} · Smart India Hackathon
      </p>
    </div>
  );
}
