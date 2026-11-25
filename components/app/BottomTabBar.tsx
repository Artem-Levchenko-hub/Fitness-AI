"use client";

import { Activity, ChartNoAxesCombined, Home, User } from "lucide-react";
import Link from "next/link";
import { motion, useTransform } from "framer-motion";
import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";
import { MAIN_TABS } from "@/lib/navigation/main-tabs";
import { useSectionNavigation } from "./SectionNavigation";

const TAB_ICONS = [Home, Activity, ChartNoAxesCombined, User];

export function BottomTabBar() {
  const navigation = useSectionNavigation();
  const indicatorLeft = useTransform(navigation.position, value => `${value * 25}%`);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const update = () => setKeyboardOpen(window.innerHeight - viewport.height > 140 && viewport.width < 768);
    viewport.addEventListener("resize", update);
    return () => viewport.removeEventListener("resize", update);
  }, []);

  return (
    <nav
      hidden={keyboardOpen}
      className="app-tab-bar bg-card/95 border-border fixed inset-x-0 bottom-0 z-50 border-t backdrop-blur-xl"
      aria-label="Главная навигация"
      data-section-tabs
      style={{ touchAction: "pan-y pinch-zoom" }}
    >
      <ul className="relative mx-auto grid max-w-2xl grid-cols-4 pt-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        <motion.li aria-hidden="true" className="pointer-events-none absolute top-3 w-1/4" style={{ left: indicatorLeft }}>
          <span className="bg-primary/10 mx-auto block h-7 w-12 rounded-full" />
        </motion.li>
        {MAIN_TABS.map((tab, index) => {
          const active = navigation.selected === index;
          const Icon = TAB_ICONS[index];
          return (
            <li key={tab.href} className="flex">
              <Link
                href={tab.href}
                prefetch={true}
                draggable={false}
                onNavigate={event => { event.preventDefault(); navigation.navigate(tab.href); }}
                aria-current={navigation.index === index ? "page" : undefined}
                aria-busy={active && navigation.pending || undefined}
                className={cn(
                  "group/tab focus-visible:ring-ring relative flex w-full flex-col items-center justify-center gap-0.5 rounded-xl py-1.5 text-[10px] font-medium tracking-tight transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-inset focus-visible:outline-none",
                  "min-h-14 text-[11px]",
                  active
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <span
                  className={cn(
                    "relative flex h-7 min-w-10 items-center justify-center rounded-full px-2 transition-[background-color,box-shadow,transform] duration-200 ease-out group-active/tab:scale-95 motion-reduce:transform-none",
                  )}
                >
                  <Icon
                    className="size-5 transition-transform duration-200 group-hover/tab:-translate-y-0.5 motion-reduce:transform-none"
                    aria-hidden="true"
                  />
                  <span aria-hidden="true" data-pending={active && navigation.pending} className="nav-pending-indicator bg-primary absolute top-0 right-1 size-1.5 rounded-full" />
                </span>
                <span>{tab.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
