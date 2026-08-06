"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/** Section card с fade+lift on viewport, subtle hover. */
export function AnimatedCard({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const reduced = useReducedMotion() ?? false;

  return (
    <motion.section
      initial={reduced ? false : { opacity: 0, y: 12 }}
      whileInView={reduced ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{
        duration: 0.4,
        ease: [0.22, 1, 0.36, 1],
        delay,
      }}
      className={cn(
        "bg-card border-border rounded-2xl border p-5",
        className,
      )}
    >
      {children}
    </motion.section>
  );
}

/** KPI plate с small hover lift + tap scale. */
export function AnimatedKpi({
  children,
  delay = 0,
  big = true,
  label,
  value,
  hint,
}: {
  children?: ReactNode;
  delay?: number;
  big?: boolean;
  label: string;
  value: string;
  hint?: string;
}) {
  const reduced = useReducedMotion() ?? false;

  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.35,
        ease: [0.22, 1, 0.36, 1],
        delay,
      }}
      whileHover={reduced ? undefined : { y: -2 }}
      whileTap={reduced ? undefined : { scale: 0.98 }}
      className="bg-card border-border cursor-default rounded-xl border p-4 transition-shadow hover:shadow-sm"
    >
      <p className="text-muted-foreground text-[10px] font-medium tracking-wide uppercase">
        {label}
      </p>
      <p
        className={cn(
          "tabular mt-1 font-semibold tracking-tight",
          big ? "text-2xl" : "text-base",
        )}
      >
        {value}
      </p>
      {hint ? (
        <p className="text-muted-foreground/70 mt-0.5 text-[10px]">{hint}</p>
      ) : null}
      {children}
    </motion.div>
  );
}
