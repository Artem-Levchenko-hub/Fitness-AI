"use client";

import { ChevronDown, Info } from "lucide-react";
import { useId, useState, type ReactNode } from "react";

import {
  MYO_REPS_LIMITATION_NOTE,
  MYO_REPS_RESEARCH_NOTE,
  MYO_REPS_SAFETY_NOTE,
  MYO_REPS_SOURCES,
  formatMyoResearchProtocol,
} from "@/lib/domain/workouts/myo-reps-evidence";
import { cn } from "@/lib/utils";

export function MyoRepsResearchNote({
  compact = false,
  summary,
  children,
}: {
  compact?: boolean;
  summary?: string;
  children?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const contentId = useId();
  const triggerId = `${contentId}-trigger`;

  return (
    <div className="border-border bg-background rounded-xl border text-xs leading-relaxed">
      <button
        id={triggerId}
        type="button"
        aria-expanded={open}
        aria-controls={contentId}
        onClick={() => setOpen((value) => !value)}
        className="focus-visible:ring-ring flex min-h-11 w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left font-medium outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
      >
        <Info className="text-primary size-4 shrink-0" aria-hidden="true" />
        <span className="min-w-0 flex-1">
          <span className="block">Myo-reps: параметры и исследования</span>
          {summary ? (
            <span className="text-muted-foreground mt-0.5 block truncate text-[11px] font-normal">
              {summary}
            </span>
          ) : null}
        </span>
        <ChevronDown
          className={cn(
            "text-muted-foreground size-4 shrink-0 transition-transform",
            open && "rotate-180",
          )}
          aria-hidden="true"
        />
      </button>

      <div
        id={contentId}
        role="region"
        aria-labelledby={triggerId}
        hidden={!open}
        className="border-border space-y-2 border-t px-3 py-3"
      >
        {children ? (
          <div className="border-border mb-3 border-b pb-3">{children}</div>
        ) : null}
        <p>{formatMyoResearchProtocol()}</p>
        <p>{MYO_REPS_RESEARCH_NOTE}</p>
        {!compact ? <p>{MYO_REPS_LIMITATION_NOTE}</p> : null}
        <p className="text-muted-foreground">{MYO_REPS_SAFETY_NOTE}</p>
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          {MYO_REPS_SOURCES.map((source) => (
            <a
              key={source.url}
              href={source.url}
              target="_blank"
              rel="noreferrer"
              className="text-primary hover:text-primary/80 underline underline-offset-4"
            >
              {source.label}
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
