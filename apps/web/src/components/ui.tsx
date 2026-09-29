"use client";

import React from "react";
import { ChevronDown, type LucideIcon } from "lucide-react";

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

/** iOS-style grouped card. */
export function Card({ className, children, style }: { className?: string; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div className={cx("rounded-[22px] bg-surface shadow-card", className)} style={style}>
      {children}
    </div>
  );
}

/** Small caps section label with icon — the Apple Weather module header. */
export function SectionLabel({ icon: Icon, children, trailing }: { icon?: LucideIcon; children: React.ReactNode; trailing?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2 px-1 mb-2.5">
      <h3 className="flex items-center gap-1.5 text-[11.5px] font-semibold uppercase tracking-[0.06em] text-label-2">
        {Icon && <Icon size={13} strokeWidth={2.4} />}
        {children}
      </h3>
      {trailing}
    </div>
  );
}

export function Collapse({ open, children, id }: { open: boolean; children: React.ReactNode; id?: string }) {
  return (
    <div className="disclosure" data-open={open} id={id} aria-hidden={!open} inert={!open}>
      <div>{children}</div>
    </div>
  );
}

/** A full-width disclosure row with a rotating chevron. */
export function DisclosureButton({
  open, onClick, icon: Icon, children, controls, className,
}: { open: boolean; onClick: () => void; icon?: LucideIcon; children: React.ReactNode; controls?: string; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={open}
      aria-controls={controls}
      className={cx("pressable w-full flex items-center gap-3 text-left", className)}
    >
      {Icon && (
        <span className="grid place-items-center w-8 h-8 rounded-[9px] bg-fill-2 text-label-2 shrink-0">
          <Icon size={16} />
        </span>
      )}
      <span className="flex-1 text-[15px] font-medium text-label">{children}</span>
      <ChevronDown
        size={18}
        className={cx("text-label-3 transition-transform duration-500 ease-[var(--ease-out)]", open && "rotate-180")}
      />
    </button>
  );
}

export function Skeleton({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return <div className={cx("skeleton", className)} style={style} aria-hidden />;
}

export function IconButton({
  label, onClick, children, className, variant = "glass",
}: { label: string; onClick?: () => void; children: React.ReactNode; className?: string; variant?: "glass" | "fill" | "plain" }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cx(
        "pressable grid place-items-center rounded-full w-9 h-9 shrink-0 text-label",
        variant === "glass" && "glass shadow-float",
        variant === "fill" && "bg-fill-2 hover:bg-fill text-label-2 hover:text-label",
        variant === "plain" && "text-label-2 hover:bg-fill-2 hover:text-label",
        className
      )}
    >
      {children}
    </button>
  );
}
