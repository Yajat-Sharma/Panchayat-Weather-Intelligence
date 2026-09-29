"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { CloudRain, Loader2, MessagesSquare, RotateCw } from "lucide-react";

import ProjectOverview from "./ProjectOverview";
import PanchayatDetail, { type Loadable } from "./PanchayatDetail";
import BlockDetail from "./BlockDetail";
import ForecastLayerControl, { type LayerState } from "./ForecastLayerControl";
import ChatbotDrawer from "./ChatbotDrawer";
import BottomSheet, { type Detent } from "./BottomSheet";
import { SearchField, SearchResults } from "./PanchayatSearch";
import { ThemeToggle } from "./ThemeToggle";
import { LanguageButton, LanguageSegmented } from "./LanguageSwitcher";
import { cx } from "./ui";
import type { Basemap, Choropleth, MapPadding } from "./Map";
import { BasemapButton, BasemapSegmented } from "./BasemapToggle";
import { useLanguage } from "../i18n/LanguageContext";
import { useMediaQuery } from "../lib/hooks";
import { formatVar, usableDays } from "../lib/weather";
import { quantize } from "../lib/scale";
import {
  api, normalizeGpcode,
  type ForecastDay, type HistoricalWeather, type MapForecast, type PanchayatCollection, type PanchayatDetails, type PanchayatEntry, type SystemStatus,
} from "../lib/api";

// Leaflet touches `window`, so the map only ever renders on the client.
const Map = dynamic(() => import("./Map"), {
  ssr: false,
  loading: () => <div className="h-full w-full bg-bg" />,
});

const SIDEBAR_W = 408;
const GOOGLE_MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || undefined;

/** Required by Google's Map Tiles terms whenever its imagery is on screen. */
function GoogleLogo({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="https://maps.gstatic.com/mapfiles/api-3/images/google_white5_hdpi.png"
      alt="Google Maps"
      width={66}
      height={26}
      className={cx("pointer-events-none select-none h-[18px] w-auto animate-fade", className)}
      style={style}
    />
  );
}

function AppMark({ className }: { className?: string }) {
  return (
    <span
      className={cx("grid place-items-center rounded-[10px] text-white shrink-0 shadow-[inset_0_0.5px_0_rgb(255_255_255/0.4),0_2px_6px_rgb(0_80_200/0.3)]", className)}
      style={{ background: "linear-gradient(160deg, #5ac8fa 0%, #007aff 55%, #0051d5 100%)" }}
    >
      <CloudRain size={18} strokeWidth={2.2} />
    </span>
  );
}

export default function Dashboard() {
  const { t, locale } = useLanguage();
  const isDesktop = useMediaQuery("(min-width: 768px)");

  // ── Base data ──────────────────────────────────────────
  const [selectedGpcode, setSelectedGpcode] = useState<string | null>(null);
  const [status, setStatus] = useState<SystemStatus | null | "error">(null);
  const [geojson, setGeojson] = useState<PanchayatCollection | null | "error">(null);
  const [baseReload, setBaseReload] = useState(0);

  useEffect(() => {
    const ctrl = new AbortController();
    api.status(ctrl.signal).then(setStatus).catch(e => !ctrl.signal.aborted && (console.error(e), setStatus("error")));
    api.panchayats(ctrl.signal).then(data => {
      setGeojson(data);
      // Deep link: ?gp=<GPCODE> reopens a panchayat.
      const gp = normalizeGpcode(new URLSearchParams(window.location.search).get("gp"));
      if (gp && data.features.some(f => normalizeGpcode(f.properties?.GPCODE) === gp)) setSelectedGpcode(gp);
    }).catch(e => !ctrl.signal.aborted && (console.error(e), setGeojson("error")));
    return () => ctrl.abort();
  }, [baseReload]);

  const retryBase = () => {
    setStatus(null);
    setGeojson(null);
    setBaseReload(n => n + 1);
  };

  const geo = geojson && geojson !== "error" ? geojson : null;

  /** One entry per GPCODE — split polygons share a code. */
  const entries = useMemo<PanchayatEntry[]>(() => {
    if (!geo) return [];
    const seen = new globalThis.Map<string, PanchayatEntry>();
    for (const f of geo.features) {
      const gp = normalizeGpcode(f.properties?.GPCODE);
      if (!gp || seen.has(gp)) continue;
      seen.set(gp, { gpcode: gp, name: f.properties?.GPNAME || gp, block: f.properties?.blkname, district: f.properties?.dtname });
    }
    return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [geo]);
  const entryByCode = useMemo(() => new globalThis.Map(entries.map(e => [e.gpcode, e])), [entries]);

  // ── Selection ──────────────────────────────────────────
  const [details, setDetails] = useState<Loadable<PanchayatDetails>>(null);
  const [forecast, setForecast] = useState<Loadable<ForecastDay[]>>(null);
  const [history, setHistory] = useState<HistoricalWeather | null>(null);
  const [selReload, setSelReload] = useState(0);
  const [selectedCrop, setSelectedCrop] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedGpcode) return;
    // Aborting on change means a slow response for an old panchayat can never overwrite the new one.
    const ctrl = new AbortController();
    const live = () => !ctrl.signal.aborted;
    api.details(selectedGpcode, ctrl.signal).then(d => live() && setDetails(d)).catch(() => live() && setDetails("error"));
    api.forecast(selectedGpcode, ctrl.signal).then(f => live() && setForecast(usableDays(f.forecast))).catch(() => live() && setForecast("error"));
    api.history(selectedGpcode, ctrl.signal).then(h => live() && setHistory(h)).catch(() => live() && setHistory(null));
    return () => ctrl.abort();
  }, [selectedGpcode, selReload]);

  // ── Block view ─────────────────────────────────────────
  const [selectedBlock, setSelectedBlock] = useState<string | null>(null);

  // ── Forecast map layer (coarse vs downscaled) ──────────
  const [layer, setLayer] = useState<LayerState>({ mode: "outlines", variable: "rainfall", date: null });
  // Keyed by request; the last good layer stays on screen while the next one loads.
  const mapKey = `${layer.variable}|${layer.date ?? ""}`;
  const [mapResult, setMapResult] = useState<{ key: string; data: MapForecast | "error" } | null>(null);
  const [mapData, setMapData] = useState<MapForecast | null>(null);
  const mapStatusState: "idle" | "loading" | "error" =
    layer.mode === "outlines" ? "idle" : mapResult?.key !== mapKey ? "loading" : mapResult.data === "error" ? "error" : "idle";

  useEffect(() => {
    if (layer.mode === "outlines") return;
    const ctrl = new AbortController();
    api.mapForecast(layer.variable, layer.date, ctrl.signal)
      .then(d => { if (!ctrl.signal.aborted) { setMapData(d); setMapResult({ key: mapKey, data: d }); } })
      .catch(() => !ctrl.signal.aborted && setMapResult({ key: mapKey, data: "error" }));
    return () => ctrl.abort();
  }, [layer.mode, layer.variable, layer.date, mapKey]);

  const layerData = layer.mode !== "outlines" && mapData?.variable === layer.variable ? mapData : null;
  // One legend for both views: the scale spans coarse and downscaled values, so switching modes is a fair comparison.
  const layerScale = useMemo(() => layerData
    ? quantize(layerData.variable, Object.values(layerData.values).flatMap(v => [v.coarse, v.value]).filter((x): x is number => x != null))
    : null, [layerData]);
  const choropleth: Choropleth | null = useMemo(() => {
    if (!layerData || !layerScale) return null;
    const key = layer.mode === "coarse" ? "coarse" : "value";
    const values = Object.fromEntries(Object.entries(layerData.values).map(([gp, v]) => [gp, v[key]]));
    return { values, color: layerScale.color, label: v => formatVar(layerData.variable, v) };
  }, [layerData, layerScale, layer.mode]);

  // ── Panel / search / sheet state ───────────────────────
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [detent, setDetent] = useState<Detent>("half");
  const [aiOpen, setAiOpen] = useState(false);
  const [basemap, setBasemap] = useState<Basemap>("satellite");
  // Falls back to Esri for the rest of the session if Google rejects the key.
  const [googleFailed, setGoogleFailed] = useState(false);
  const googleKey = googleFailed ? undefined : GOOGLE_MAPS_KEY;
  const showGoogleLogo = basemap === "satellite" && !!googleKey;
  const [scrolled, setScrolled] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const syncUrl = (gp: string | null) => {
    const url = new URL(window.location.href);
    if (gp) url.searchParams.set("gp", gp);
    else url.searchParams.delete("gp");
    window.history.replaceState(null, "", url);
  };

  const select = (gp: string) => {
    syncUrl(gp);
    setSelectedBlock(null);
    if (gp !== selectedGpcode) {
      setSelectedGpcode(gp);
      setDetails(null);
      setForecast(null);
      setHistory(null);
    }
    setQuery("");
    setSearching(false);
    searchRef.current?.blur();
    setDetent("half");
  };

  const closeDetail = () => {
    syncUrl(null);
    setSelectedGpcode(null);
    setSelectedBlock(null);
    setDetent("half");
  };

  const openBlock = (block: string) => {
    setSelectedBlock(block);
    setDetent("half");
  };

  const retrySelection = () => {
    setDetails(null);
    setForecast(null);
    setSelReload(n => n + 1);
  };

  const startSearch = () => {
    setSearching(true);
    if (!isDesktop) setDetent("full");
  };

  const cancelSearch = () => {
    setQuery("");
    setSearching(false);
    searchRef.current?.blur();
    if (!isDesktop) setDetent("half");
  };

  const selectedEntry = selectedGpcode ? entryByCode.get(selectedGpcode) : undefined;
  const panchayatName =
    (details && details !== "error" ? details.GPNAME : undefined) || selectedEntry?.name || null;

  // ── Map padding keeps the selection clear of floating chrome ─
  const [vh, setVh] = useState(800);
  useEffect(() => {
    const update = () => setVh(window.innerHeight);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const padding: MapPadding = isDesktop
    ? { topLeft: [SIDEBAR_W + 48, 48], bottomRight: [72, 48] }
    : { topLeft: [24, 80], bottomRight: [24, Math.round(vh * 0.5) + 24] };

  // ── Panel content ──────────────────────────────────────
  const panelKey = searching ? "search" : selectedBlock ? `block:${selectedBlock}` : selectedGpcode ?? "overview";
  const panelBody = searching ? (
    <SearchResults entries={entries} query={query} onSelect={select} />
  ) : selectedBlock ? (
    <BlockDetail
      key={selectedBlock}
      block={selectedBlock}
      onClose={closeDetail}
      onBack={selectedGpcode ? () => setSelectedBlock(null) : undefined}
      onSelectPanchayat={select}
    />
  ) : selectedGpcode ? (
    <PanchayatDetail
      key={selectedGpcode}
      gpcode={selectedGpcode}
      onOpenBlock={openBlock}
      entry={selectedEntry}
      details={details}
      forecast={forecast}
      history={history}
      onClose={closeDetail}
      onRetry={retrySelection}
      onAskAi={() => setAiOpen(true)}
      selectedCrop={selectedCrop}
      setSelectedCrop={setSelectedCrop}
    />
  ) : (
    <ProjectOverview status={status} panchayatCount={geo ? entries.length : null} onRetry={retryBase} />
  );

  const searchField = (
    <SearchField
      ref={searchRef}
      query={query}
      onQueryChange={q => { setQuery(q); if (!searching) startSearch(); }}
      onFocus={startSearch}
      onCancel={cancelSearch}
      active={searching}
    />
  );

  const mapStatus = geojson === null ? (
    <div className="glass shadow-float rounded-full px-3.5 h-9 flex items-center gap-2 text-[13px] font-medium text-label animate-fade">
      <Loader2 size={15} className="animate-spin text-accent" /> {t("sys.loading")}
    </div>
  ) : geojson === "error" ? (
    <button onClick={retryBase} className="pressable glass shadow-float rounded-full px-3.5 h-9 flex items-center gap-2 text-[13px] font-medium text-label">
      <RotateCw size={14} className="text-accent" /> {t("overview.offline")} · <span className="text-accent">{t("sys.retry")}</span>
    </button>
  ) : null;

  return (
    <div className="fixed inset-0 overflow-hidden bg-bg text-label">
      {/* Map canvas */}
      <div className="absolute inset-0">
        {isDesktop !== null && (
          <Map
            geojsonData={geo}
            selectedGpcode={selectedGpcode}
            onSelectPanchayat={select}
            padding={padding}
            showZoom={isDesktop}
            basemap={basemap}
            googleKey={googleKey}
            locale={locale}
            onGoogleFail={() => setGoogleFailed(true)}
            choropleth={choropleth}
          />
        )}
      </div>

      {isDesktop === true && (
        <>
          <aside
            className="absolute left-3 top-3 bottom-3 z-[500] flex flex-col rounded-[28px] glass-panel shadow-float overflow-hidden animate-fade"
            style={{ width: SIDEBAR_W }}
          >
            <div className={cx("shrink-0 px-5 pt-5 pb-3.5 transition-shadow duration-300", scrolled && "shadow-[0_0.5px_0_var(--separator)]")}>
              <div className="flex items-center gap-2.5 mb-4">
                <AppMark className="w-9 h-9" />
                <div className="flex-1 min-w-0 leading-tight">
                  <div className="text-[16px] font-semibold tracking-[-0.015em] truncate">{t("nav.title")}</div>
                  <div className="text-[12px] text-label-2 truncate">{t("nav.subtitle")}</div>
                </div>
                <LanguageSegmented />
                <ThemeToggle />
              </div>
              {searchField}
            </div>
            <div
              className="flex-1 min-h-0 overflow-y-auto overscroll-contain thin-scrollbar px-5"
              onScroll={e => setScrolled(e.currentTarget.scrollTop > 4)}
            >
              <div key={panelKey} className="animate-fade">{panelBody}</div>
            </div>
          </aside>

          {showGoogleLogo && (
            <GoogleLogo className="absolute bottom-3 z-[450]" style={{ left: SIDEBAR_W + 24 }} />
          )}

          <div className="absolute top-[10px] right-[62px] z-[450] animate-fade flex flex-col items-end gap-2">
            <BasemapSegmented value={basemap} onChange={setBasemap} />
            <ForecastLayerControl
              value={layer}
              onChange={setLayer}
              dates={mapData?.dates ?? []}
              scale={layerScale}
              unit={layerData?.unit ?? ""}
              status={mapStatusState}
              modelTrained={layerData?.downscaled ?? true}
            />
          </div>

          {mapStatus && (
            <div className="absolute top-5 z-[450] -translate-x-1/2" style={{ left: `calc(50% + ${SIDEBAR_W / 2}px)` }}>{mapStatus}</div>
          )}

          <button
            onClick={() => setAiOpen(true)}
            aria-label={t("ai.askPanchayatAi")}
            className={cx(
              "pressable absolute right-5 bottom-5 z-[600] h-12 pl-2 pr-4 rounded-full glass shadow-float flex items-center gap-2.5 text-[15px] font-semibold text-label",
              "transition-[opacity,transform] duration-500 ease-[var(--ease-spring)]",
              aiOpen ? "opacity-0 scale-75 pointer-events-none" : "opacity-100 scale-100 hover:scale-[1.03]"
            )}
          >
            <span className="grid place-items-center w-8 h-8 rounded-full text-white bg-accent">
              <MessagesSquare size={16} />
            </span>
            {t("ai.askPanchayatAi")}
          </button>
        </>
      )}

      {isDesktop === false && (
        <>
          {/* Floating top bar */}
          <div className="fixed inset-x-0 top-0 z-[400] flex items-center gap-2 px-3 pt-[calc(env(safe-area-inset-top)+10px)] pointer-events-none">
            <div className="pointer-events-auto glass shadow-float rounded-full h-9 pl-1 pr-3.5 flex items-center gap-2 min-w-0 animate-fade">
              <AppMark className="w-7 h-7 rounded-full" />
              <span className="text-[14px] font-semibold tracking-[-0.01em] truncate">{t("nav.title")}</span>
            </div>
            <div className="flex-1" />
            <div className="pointer-events-auto flex items-center gap-2 animate-fade">
              <LanguageButton />
              <ThemeToggle variant="glass" />
              <button
                onClick={() => setAiOpen(true)}
                aria-label={t("ai.askPanchayatAi")}
                className="pressable grid place-items-center w-9 h-9 rounded-full text-white bg-accent shadow-float"
              >
                <MessagesSquare size={17} />
              </button>
            </div>
          </div>

          {showGoogleLogo && <GoogleLogo className="fixed left-4 top-[calc(env(safe-area-inset-top)+64px)] z-[400]" />}

          <div className="fixed right-3 top-[calc(env(safe-area-inset-top)+56px)] z-[400] animate-fade flex flex-col items-end gap-2">
            <BasemapButton value={basemap} onChange={setBasemap} />
            <ForecastLayerControl
              value={layer}
              onChange={setLayer}
              dates={mapData?.dates ?? []}
              scale={layerScale}
              unit={layerData?.unit ?? ""}
              status={mapStatusState}
              modelTrained={layerData?.downscaled ?? true} compact
            />
          </div>

          {mapStatus && <div className="fixed left-1/2 -translate-x-1/2 top-[calc(env(safe-area-inset-top)+58px)] z-[400]">{mapStatus}</div>}

          <BottomSheet
            detent={detent}
            onDetentChange={setDetent}
            contentKey={panelKey}
            header={<div className="px-4 pb-3">{searchField}</div>}
          >
            <div key={panelKey} className="animate-fade">{panelBody}</div>
          </BottomSheet>
        </>
      )}

      {isDesktop !== null && (
        <ChatbotDrawer
          open={aiOpen}
          onClose={() => setAiOpen(false)}
          selectedGpcode={selectedGpcode}
          panchayatName={panchayatName}
          selectedCrop={selectedCrop}
          isDesktop={isDesktop}
        />
      )}
    </div>
  );
}
