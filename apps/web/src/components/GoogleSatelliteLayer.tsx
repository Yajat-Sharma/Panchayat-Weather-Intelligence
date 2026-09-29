"use client";

import { useEffect, useRef, useState } from "react";
import { TileLayer, useMap } from "react-leaflet";

/**
 * Google Map Tiles API (2D) satellite imagery with the roadmap label layer overlaid (a "hybrid" view),
 * rendered through Leaflet. Requires NEXT_PUBLIC_GOOGLE_MAPS_API_KEY with the Map Tiles API enabled.
 *
 * Terms: Google's live copyright string (viewport endpoint) must be shown with the tiles, and the
 * Google logo must be visible — the logo is placed by the Dashboard, which knows where the chrome sits.
 */
const TILE_API = "https://tile.googleapis.com";

// Sessions are valid for ~2 weeks; reuse per language instead of creating one on every remount.
const sessions = new Map<string, Promise<string>>();

function createSession(key: string, language: string): Promise<string> {
  const cacheKey = `${language}:${window.devicePixelRatio > 1 ? 2 : 1}`;
  let s = sessions.get(cacheKey);
  if (!s) {
    const hiDpi = window.devicePixelRatio > 1;
    s = fetch(`${TILE_API}/v1/createSession?key=${encodeURIComponent(key)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mapType: "satellite",
        language,
        // Region IN: Google serves India's legally mandated border depiction.
        region: "IN",
        layerTypes: ["layerRoadmap"],
        ...(hiDpi ? { scale: "scaleFactor2x", highDpi: true } : {}),
      }),
    }).then(async r => {
      if (!r.ok) throw new Error(`createSession ${r.status}: ${await r.text()}`);
      const data = (await r.json()) as { session: string };
      return data.session;
    });
    s.catch(() => sessions.delete(cacheKey));
    sessions.set(cacheKey, s);
  }
  return s;
}

interface Props {
  apiKey: string;
  language: string;
  onFail: () => void;
}

export default function GoogleSatelliteLayer({ apiKey, language, onFail }: Props) {
  const map = useMap();
  const [session, setSession] = useState<string | null>(null);
  const tileErrors = useRef(0);
  const onFailRef = useRef(onFail);
  useEffect(() => {
    onFailRef.current = onFail;
  }, [onFail]);

  useEffect(() => {
    let live = true;
    createSession(apiKey, language)
      .then(s => live && setSession(s))
      .catch(e => {
        console.warn("Google Map Tiles unavailable, falling back to Esri imagery.", e);
        if (live) onFailRef.current();
      });
    return () => {
      live = false;
    };
  }, [apiKey, language]);

  // Keep the required copyright string in sync with what's on screen.
  useEffect(() => {
    if (!session) return;
    const ctrl = map.attributionControl;
    let current = "";
    let timer: ReturnType<typeof setTimeout>;
    let abort: AbortController | null = null;

    const refresh = () => {
      clearTimeout(timer);
      timer = setTimeout(async () => {
        abort?.abort();
        abort = new AbortController();
        const b = map.getBounds();
        const params = new URLSearchParams({
          session,
          key: apiKey,
          zoom: String(Math.round(map.getZoom())),
          north: String(b.getNorth()),
          south: String(b.getSouth()),
          east: String(b.getEast()),
          west: String(b.getWest()),
        });
        try {
          const r = await fetch(`${TILE_API}/tile/v1/viewport?${params}`, { signal: abort.signal });
          if (!r.ok) return;
          const { copyright } = (await r.json()) as { copyright?: string };
          const next = copyright || "©Google";
          if (next === current) return;
          if (current) ctrl?.removeAttribution(current);
          ctrl?.addAttribution(next);
          current = next;
        } catch {}
      }, 350);
    };

    refresh();
    map.on("moveend", refresh);
    return () => {
      map.off("moveend", refresh);
      clearTimeout(timer);
      abort?.abort();
      if (current) ctrl?.removeAttribution(current);
    };
  }, [map, session, apiKey]);

  if (!session) return null;

  return (
    <TileLayer
      key={session}
      url={`${TILE_API}/v1/2dtiles/{z}/{x}/{y}?session=${session}&key=${encodeURIComponent(apiKey)}`}
      maxZoom={19}
      maxNativeZoom={19}
      eventHandlers={{
        // A key that can create sessions but not fetch tiles (billing / quota) — bail out to Esri.
        tileerror: () => {
          if (++tileErrors.current === 6) onFailRef.current();
        },
        tileload: () => {
          tileErrors.current = 0;
        },
      }}
    />
  );
}
