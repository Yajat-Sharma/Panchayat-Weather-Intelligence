"use client";

import { forwardRef, useMemo } from "react";
import { ChevronRight, MapPin, Search, X } from "lucide-react";
import { useLanguage } from "../i18n/LanguageContext";
import type { PanchayatEntry } from "../lib/api";
import { cx } from "./ui";

interface FieldProps {
  query: string;
  onQueryChange: (q: string) => void;
  onFocus?: () => void;
  onCancel: () => void;
  active: boolean;
}

export const SearchField = forwardRef<HTMLInputElement, FieldProps>(function SearchField(
  { query, onQueryChange, onFocus, onCancel, active },
  ref
) {
  const { t } = useLanguage();
  return (
    <div className="flex items-center gap-2">
      <label className="flex-1 flex items-center gap-2 h-10 px-3 rounded-[12px] bg-fill-2 focus-within:bg-fill transition-colors">
        <Search size={16} className="text-label-3 shrink-0" />
        <input
          ref={ref}
          type="search"
          inputMode="search"
          enterKeyHint="search"
          autoComplete="off"
          spellCheck={false}
          value={query}
          onChange={e => onQueryChange(e.target.value)}
          onFocus={onFocus}
          onKeyDown={e => e.key === "Escape" && onCancel()}
          placeholder={t("search.placeholder")}
          aria-label={t("search.placeholder")}
          className="flex-1 min-w-0 bg-transparent outline-none text-[16px] md:text-[15px] text-label placeholder:text-label-3 [&::-webkit-search-cancel-button]:hidden"
        />
        {query && (
          <button type="button" aria-label="Clear" onClick={() => onQueryChange("")} className="grid place-items-center w-[18px] h-[18px] rounded-full bg-label-3/50 text-surface animate-fade">
            <X size={11} strokeWidth={3} />
          </button>
        )}
      </label>
      <button
        type="button"
        onClick={onCancel}
        className={cx(
          "text-[15px] text-accent font-medium overflow-hidden whitespace-nowrap transition-all duration-400 ease-[var(--ease-out)]",
          active ? "max-w-24 opacity-100" : "max-w-0 opacity-0 pointer-events-none"
        )}
        tabIndex={active ? 0 : -1}
      >
        {t("search.cancel")}
      </button>
    </div>
  );
});

const norm = (s: string) => s.toLocaleLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "");

function Highlight({ text, q }: { text: string; q: string }) {
  const i = q ? norm(text).indexOf(norm(q)) : -1;
  if (i < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, i)}
      <mark className="bg-transparent text-accent font-semibold">{text.slice(i, i + q.length)}</mark>
      {text.slice(i + q.length)}
    </>
  );
}

export function SearchResults({ entries, query, onSelect }: { entries: PanchayatEntry[]; query: string; onSelect: (gp: string) => void }) {
  const { t } = useLanguage();
  const q = query.trim();

  const results = useMemo(() => {
    if (!q) return entries.slice(0, 40);
    const nq = norm(q);
    const scored: { e: PanchayatEntry; s: number }[] = [];
    for (const e of entries) {
      const name = norm(e.name);
      let s = -1;
      if (name.startsWith(nq)) s = 0;
      else if (name.includes(" " + nq)) s = 1;
      else if (name.includes(nq)) s = 2;
      else if (e.block && norm(e.block).includes(nq)) s = 3;
      if (s >= 0) scored.push({ e, s });
    }
    return scored.sort((a, b) => a.s - b.s || a.e.name.localeCompare(b.e.name)).slice(0, 60).map(x => x.e);
  }, [entries, q]);

  if (q && results.length === 0) {
    return (
      <div className="py-16 text-center animate-fade">
        <Search size={28} className="mx-auto text-label-3 mb-3" />
        <p className="text-[15px] text-label-2">{t("search.noResults", { q })}</p>
      </div>
    );
  }

  return (
    <div className="pt-1 pb-4 animate-fade">
      <div className="text-[11.5px] font-semibold uppercase tracking-[0.06em] text-label-2 px-1 mb-2">{t("search.results")}</div>
      <ul className="rounded-[18px] bg-surface shadow-card overflow-hidden">
        {results.map((e, i) => (
          <li key={e.gpcode}>
            <button
              type="button"
              onClick={() => onSelect(e.gpcode)}
              className="w-full flex items-center gap-3 pl-3 pr-2.5 text-left hover:bg-fill-3 active:bg-fill-2 transition-colors"
            >
              <span className="grid place-items-center w-8 h-8 rounded-full bg-accent/12 text-accent shrink-0">
                <MapPin size={15} />
              </span>
              <span className={cx("flex-1 min-w-0 py-2.5", i > 0 && "border-t border-separator")}>
                <span className="block text-[15px] text-label truncate"><Highlight text={e.name} q={q} /></span>
                {(e.block || e.district) && (
                  <span className="block text-[12.5px] text-label-2 truncate">
                    {[e.block, e.district].filter(Boolean).join(" · ")}
                  </span>
                )}
              </span>
              <ChevronRight size={16} className="text-label-3 shrink-0" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
