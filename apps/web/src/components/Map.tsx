"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { MapContainer, TileLayer, GeoJSON, Pane, ZoomControl, useMap } from "react-leaflet";
import L from "leaflet";
import { useTheme } from "next-themes";
import type { Feature } from "geojson";
import { normalizeGpcode, type PanchayatCollection } from "../lib/api";
import GoogleSatelliteLayer from "./GoogleSatelliteLayer";

export interface MapPadding {
  topLeft: [number, number];
  bottomRight: [number, number];
}

interface MapProps {
  geojsonData: PanchayatCollection | null;
  selectedGpcode?: string | null;
  onSelectPanchayat: (gpcode: string) => void;
  padding: MapPadding;
  showZoom?: boolean;
  basemap: Basemap;
  /** Google Map Tiles API key; when set, satellite imagery comes from Google instead of Esri. */
  googleKey?: string;
  /** BCP-47 locale for Google's map labels. */
  locale: string;
  onGoogleFail?: () => void;
  /** When set, Panchayats are filled by value (forecast layer); `null` values stay unfilled. */
  choropleth?: Choropleth | null;
}

export interface Choropleth {
  values: Record<string, number | null>;
  color: (v: number) => string;
  /** Tooltip text for a Panchayat's value. */
  label: (v: number | null) => string;
}

export type Basemap = "satellite" | "map";

const OSM_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const OSM_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
// Esri World Imagery is keyless; its reference layer puts place names back on top of the photo.
const ESRI = "https://server.arcgisonline.com/ArcGIS/rest/services";
const SAT_URL = `${ESRI}/World_Imagery/MapServer/tile/{z}/{y}/{x}`;
const SAT_LABELS_URL = `${ESRI}/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}`;
const SAT_ATTRIBUTION = 'Imagery &copy; <a href="https://www.esri.com">Esri</a>, Maxar, Earthstar Geographics';

const palette = (dark: boolean, basemap: Basemap) => {
  if (basemap === "satellite") {
    // Aerial imagery is busy and dark: white hairlines for context, a bright accent for the selection.
    return {
      base: { color: "#ffffff", weight: 0.9, opacity: 0.55, fillColor: "#ffffff", fillOpacity: 0.02 },
      hover: { color: "#ffffff", weight: 2, opacity: 0.95, fillColor: "#ffffff", fillOpacity: 0.16 },
      selected: { color: "#4da3ff", weight: 3, opacity: 1, fillColor: "#0a84ff", fillOpacity: 0.3 },
    };
  }
  const accent = dark ? "#0a84ff" : "#007aff";
  return {
    base: { color: accent, weight: 0.8, opacity: dark ? 0.45 : 0.4, fillColor: accent, fillOpacity: dark ? 0.06 : 0.05 },
    hover: { color: accent, weight: 1.6, opacity: 0.9, fillColor: accent, fillOpacity: 0.18 },
    selected: { color: accent, weight: 2.6, opacity: 1, fillColor: accent, fillOpacity: dark ? 0.34 : 0.26 },
  };
};

const codeOf = (f?: Feature) => normalizeGpcode(f?.properties?.GPCODE);

/** Flies to the selection (or the whole district) whenever it changes. */
function CameraController({ data, selected, padding }: { data: PanchayatCollection | null; selected?: string | null; padding: MapPadding }) {
  const map = useMap();
  const fittedAll = useRef(false);
  const paddingRef = useRef(padding);
  useLayoutEffect(() => {
    paddingRef.current = padding;
  }, [padding]);

  const allBounds = useMemo(() => (data ? L.geoJSON(data).getBounds() : null), [data]);

  useEffect(() => {
    if (!allBounds?.isValid() || fittedAll.current) return;
    fittedAll.current = true;
    map.fitBounds(allBounds, { paddingTopLeft: paddingRef.current.topLeft, paddingBottomRight: paddingRef.current.bottomRight, animate: false });
  }, [allBounds, map]);

  useEffect(() => {
    if (!data || !selected) return;
    const feats = data.features.filter(f => codeOf(f) === selected);
    if (!feats.length) return;
    const b = L.geoJSON({ type: "FeatureCollection", features: feats } as PanchayatCollection).getBounds();
    if (!b.isValid()) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    map.flyToBounds(b, {
      paddingTopLeft: paddingRef.current.topLeft,
      paddingBottomRight: paddingRef.current.bottomRight,
      maxZoom: 12,
      duration: reduce ? 0 : 0.9,
      easeLinearity: 0.2,
    });
  }, [data, selected, map]);

  return null;
}

export default function Map({ geojsonData, selectedGpcode, onSelectPanchayat, padding, showZoom = true, basemap, googleKey, locale, onGoogleFail, choropleth }: MapProps) {
  const { resolvedTheme } = useTheme();
  const dark = resolvedTheme === "dark";
  const layerRef = useRef<L.GeoJSON | null>(null);
  // Add overlays only once the map exists; mounting them in the same commit as the container
  // races StrictMode's remount and leaves layers pointing at a destroyed map.
  const [ready, setReady] = useState(false);

  // Leaflet handlers are bound once per feature; read live values through refs so they never go stale.
  const selectedRef = useRef(selectedGpcode);
  const paletteRef = useRef(palette(dark, basemap));
  const onSelectRef = useRef(onSelectPanchayat);
  const choroRef = useRef(choropleth);
  const darkRef = useRef(dark);

  // Stable across renders; only ever called from Leaflet, after refs are synced.
  const styleFor = useCallback((f?: Feature) => {
    const p = paletteRef.current;
    const gp = codeOf(f);
    const ch = choroRef.current;
    if (ch) {
      const v = gp ? ch.values[gp] : null;
      const fill = v != null ? { fillColor: ch.color(v), fillOpacity: 0.82 } : { fillColor: "#888", fillOpacity: 0.05 };
      // A 0.5px surface-coloured edge separates adjacent fills; the selection keeps its accent ring.
      return gp === selectedRef.current
        ? { ...fill, color: p.selected.color, weight: 3, opacity: 1 }
        : { ...fill, color: darkRef.current ? "#1c1c1e" : "#ffffff", weight: 0.5, opacity: 0.7 };
    }
    return gp === selectedRef.current ? p.selected : p.base;
  }, []);

  useLayoutEffect(() => {
    onSelectRef.current = onSelectPanchayat;
  }, [onSelectPanchayat]);

  useLayoutEffect(() => {
    selectedRef.current = selectedGpcode;
    paletteRef.current = palette(dark, basemap);
    choroRef.current = choropleth;
    darkRef.current = dark;
    const layer = layerRef.current;
    if (!layer) return;
    layer.setStyle(styleFor);
    layer.eachLayer(l => {
      const path = l as L.Path & { feature?: Feature };
      if (codeOf(path.feature) === selectedGpcode) path.bringToFront();
    });
    layer.eachLayer(l => {
      const path = l as L.Path & { feature?: Feature };
      const gp = codeOf(path.feature);
      const name = path.feature?.properties?.GPNAME ?? "";
      if (!path.getTooltip()) return;
      path.setTooltipContent(choropleth && gp ? `${name} · ${choropleth.label(choropleth.values[gp] ?? null)}` : name);
    });
  }, [selectedGpcode, dark, basemap, styleFor, choropleth]);

  const canHover = typeof window !== "undefined" && window.matchMedia("(hover: hover)").matches;

  return (
    <MapContainer
      center={[18.5204, 73.8567]}
      zoom={9}
      zoomControl={false}
      scrollWheelZoom
      zoomSnap={0.25}
      maxZoom={18}
      whenReady={() => setReady(true)}
      style={{ height: "100%", width: "100%", zIndex: 0 }}
    >
      {basemap === "satellite" && googleKey ? (
        <GoogleSatelliteLayer apiKey={googleKey} language={locale} onFail={() => onGoogleFail?.()} />
      ) : basemap === "satellite" ? (
        <>
          <TileLayer key="sat" attribution={SAT_ATTRIBUTION} url={SAT_URL} maxZoom={19} maxNativeZoom={18} className="pwi-satellite" />
          <Pane name="labels" style={{ zIndex: 450, pointerEvents: "none" }}>
            <TileLayer key="sat-labels" url={SAT_LABELS_URL} maxZoom={19} maxNativeZoom={18} />
          </Pane>
        </>
      ) : (
        <TileLayer key="osm" attribution={OSM_ATTRIBUTION} url={OSM_URL} maxZoom={19} className="pwi-tiles" />
      )}
      {showZoom && <ZoomControl position="topright" />}
      {ready && <CameraController data={geojsonData} selected={selectedGpcode} padding={padding} />}

      {ready && geojsonData && (
        <GeoJSON
          ref={layerRef}
          data={geojsonData}
          style={styleFor}
          onEachFeature={(feature, layer) => {
            const path = layer as L.Path;
            path.on({
              mouseover: () => {
                if (codeOf(feature) === selectedRef.current) return;
                path.setStyle(choroRef.current ? { weight: 2, opacity: 1, color: darkRef.current ? "#fff" : "#1c1c1e" } : paletteRef.current.hover);
              },
              mouseout: () => {
                if (codeOf(feature) !== selectedRef.current) path.setStyle(styleFor(feature));
              },
              click: () => {
                const gp = codeOf(feature);
                if (gp) onSelectRef.current(gp);
              },
            });
            if (canHover && feature.properties?.GPNAME) {
              path.bindTooltip(feature.properties.GPNAME, { sticky: true, direction: "top", offset: [0, -10], className: "pwi-tooltip" });
            }
          }}
        />
      )}
    </MapContainer>
  );
}
