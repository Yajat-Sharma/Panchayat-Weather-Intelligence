"use client";

import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

export type Detent = "peek" | "half" | "full";

interface Props {
  detent: Detent;
  onDetentChange: (d: Detent) => void;
  header: React.ReactNode;
  children: React.ReactNode;
  /** Visible height at the peek detent, excluding the bottom safe area. */
  peekHeight?: number;
  /** Changing this scrolls the content back to the top (e.g. a new panchayat). */
  contentKey?: string;
}

const TRANSITION = "transform 0.5s var(--ease-sheet)";

/**
 * Apple Maps–style sheet. The sheet is always full height and slides with `transform` only,
 * so dragging never triggers layout. Content gets bottom padding equal to the hidden part,
 * which keeps every section reachable at the half detent.
 */
export default function BottomSheet({ detent, onDetentChange, header, children, peekHeight = 132, contentKey }: Props) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ sheet: 0, viewport: 0, safeBottom: 0 });

  useLayoutEffect(() => {
    const measure = () => {
      const sheet = sheetRef.current;
      if (!sheet) return;
      const probe = document.createElement("div");
      probe.style.cssText = "position:fixed;bottom:0;height:env(safe-area-inset-bottom);visibility:hidden";
      document.body.appendChild(probe);
      const safeBottom = probe.offsetHeight;
      probe.remove();
      setSize({ sheet: sheet.offsetHeight, viewport: window.innerHeight, safeBottom });
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  const offsets = useCallback((): Record<Detent, number> => {
    const { sheet, viewport, safeBottom } = size;
    return {
      full: 0,
      half: Math.max(0, sheet - Math.round(viewport * 0.5)),
      peek: Math.max(0, sheet - peekHeight - safeBottom),
    };
  }, [size, peekHeight]);

  const detentRef = useRef(detent);
  useLayoutEffect(() => {
    detentRef.current = detent;
  }, [detent]);

  const apply = useCallback((y: number, animate: boolean) => {
    const el = sheetRef.current;
    if (!el) return;
    el.style.transition = animate ? TRANSITION : "none";
    el.style.transform = `translate3d(0, ${y}px, 0)`;
  }, []);

  // Settle on the controlled detent.
  useEffect(() => {
    if (!size.sheet) return;
    const y = offsets()[detent];
    apply(y, true);
    if (contentRef.current) contentRef.current.style.paddingBottom = `${y + 24}px`;
  }, [detent, size, offsets, apply]);

  useEffect(() => {
    contentRef.current?.scrollTo({ top: 0 });
  }, [contentKey]);

  // ── Gesture core ─────────────────────────────────────────
  const drag = useRef<{ startY: number; startOffset: number; samples: { y: number; t: number }[] } | null>(null);

  const rubber = (y: number) => {
    const o = offsets();
    if (y < 0) return y * 0.25;
    if (y > o.peek) return o.peek + (y - o.peek) * 0.25;
    return y;
  };

  const begin = (clientY: number) => {
    drag.current = { startY: clientY, startOffset: offsets()[detentRef.current], samples: [{ y: clientY, t: performance.now() }] };
  };

  const move = (clientY: number) => {
    const d = drag.current;
    if (!d) return;
    d.samples.push({ y: clientY, t: performance.now() });
    if (d.samples.length > 5) d.samples.shift();
    apply(rubber(d.startOffset + clientY - d.startY), false);
  };

  const end = (clientY: number) => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    const first = d.samples[0];
    const last = d.samples[d.samples.length - 1];
    const dt = Math.max(1, last.t - first.t);
    const velocity = (last.y - first.y) / dt; // px/ms, + = downward
    const current = d.startOffset + clientY - d.startY;
    const projected = current + velocity * 220;
    const o = offsets();
    const order: Detent[] = ["full", "half", "peek"];
    const target = order.reduce((best, k) => (Math.abs(o[k] - projected) < Math.abs(o[best] - projected) ? k : best), "half" as Detent);
    apply(o[target], true);
    if (contentRef.current) contentRef.current.style.paddingBottom = `${o[target] + 24}px`;
    if (target !== detentRef.current) onDetentChange(target);
  };

  // Handle/header: pointer events (works for touch and mouse). Capture only once it's clearly a drag,
  // so taps on buttons and inputs inside the header still land.
  const headerGesture = useRef<{ y: number; active: boolean; id: number } | null>(null);
  const onHeaderPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    headerGesture.current = { y: e.clientY, active: false, id: e.pointerId };
  };
  const onHeaderPointerMove = (e: React.PointerEvent) => {
    const g = headerGesture.current;
    if (!g) return;
    if (!g.active) {
      if (Math.abs(e.clientY - g.y) < 5) return;
      g.active = true;
      (e.currentTarget as HTMLElement).setPointerCapture(g.id);
      begin(g.y);
    }
    move(e.clientY);
  };
  const onHeaderPointerUp = (e: React.PointerEvent) => {
    const g = headerGesture.current;
    headerGesture.current = null;
    if (g?.active) end(e.clientY);
  };

  // Content: native touch listeners (non-passive) so we can take over from scrolling at the right moment.
  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    let startY = 0;
    let mode: "undecided" | "drag" | "scroll" = "undecided";

    const onStart = (e: TouchEvent) => {
      startY = e.touches[0].clientY;
      mode = "undecided";
    };
    const onMove = (e: TouchEvent) => {
      const y = e.touches[0].clientY;
      if (mode === "undecided") {
        const dy = y - startY;
        if (dy === 0) return;
        const atTop = el.scrollTop <= 0;
        mode = (dy > 0 && atTop) || (dy < 0 && detentRef.current !== "full") ? "drag" : "scroll";
        if (mode === "drag") begin(startY);
      }
      if (mode === "drag") {
        e.preventDefault();
        move(y);
      }
    };
    const onEnd = (e: TouchEvent) => {
      if (mode === "drag") end(e.changedTouches[0].clientY);
      mode = "undecided";
    };

    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchmove", onMove, { passive: false });
    el.addEventListener("touchend", onEnd);
    el.addEventListener("touchcancel", onEnd);
    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onEnd);
      el.removeEventListener("touchcancel", onEnd);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size]);

  const cycle = () => onDetentChange(detent === "peek" ? "half" : detent === "half" ? "full" : "half");

  return (
    <div
      ref={sheetRef}
      className="fixed inset-x-0 bottom-0 z-[500] flex flex-col rounded-t-[28px] glass-panel shadow-pop will-change-transform"
      style={{ top: "calc(env(safe-area-inset-top) + 10px)", transform: "translate3d(0, 100%, 0)" }}
    >
      <div
        className="shrink-0 touch-none select-none"
        onPointerDown={onHeaderPointerDown}
        onPointerMove={onHeaderPointerMove}
        onPointerUp={onHeaderPointerUp}
        onPointerCancel={onHeaderPointerUp}
      >
        <button
          type="button"
          aria-label="Resize panel"
          onClick={cycle}
          className="w-full flex justify-center pt-2 pb-1.5"
        >
          <span className="block w-9 h-[5px] rounded-full bg-label-3/60" />
        </button>
        {header}
      </div>
      <div ref={contentRef} className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4">
        {children}
      </div>
    </div>
  );
}
