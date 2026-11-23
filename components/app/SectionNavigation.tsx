"use client";

import { animate, AnimatePresence, motion, type MotionValue, useMotionValue, useReducedMotion } from "framer-motion";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useRef, useState, useTransition, type PointerEvent, type ReactNode } from "react";

import { MAIN_TABS, mainTabIndex, rootTabIndex, swipeTarget } from "@/lib/navigation/main-tabs";

type Navigation = {
  index: number;
  selected: number;
  pending: boolean;
  direction: number;
  position: MotionValue<number>;
  offset: MotionValue<number>;
  navigate: (href: string) => void;
};
const SectionContext = createContext<Navigation | null>(null);

export function useSectionNavigation(): Navigation {
  const navigation = useContext(SectionContext);
  if (!navigation) throw new Error("Section navigation needs the app shell");
  return navigation;
}

type Gesture = { id: number; x: number; y: number; startedAt: number; horizontal: boolean; width: number };

function ownsGesture(target: Element, boundary: HTMLElement): boolean {
  if (target.closest('input, textarea, select, button, canvas, [contenteditable="true"], [role="slider"], [role="dialog"], [role="application"], [data-swipe-block], .recharts-wrapper')) return true;
  for (let node: Element | null = target; node && node !== boundary; node = node.parentElement) {
    if (node.scrollWidth > node.clientWidth + 1 && /auto|scroll/.test(getComputedStyle(node).overflowX)) return true;
  }
  return false;
}

export function SectionNavigation({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const index = mainTabIndex(pathname);
  const reduced = useReducedMotion();
  const [pending, startNavigation] = useTransition();
  const [intent, setIntent] = useState({ href: "", direction: 0 });
  const [hint, setHint] = useState<number | null>(null);
  const position = useMotionValue(Math.max(0, index));
  const offset = useMotionValue(0);
  const gesture = useRef<Gesture | null>(null);
  const suppressClick = useRef(false);
  const scrollPositions = useRef(new Map<string, number>());
  const requestedTab = useRef<string | null>(null);
  const selected = pending && intent.href ? mainTabIndex(intent.href) : index;

  useEffect(() => {
    const historyNavigation = () => setIntent({ href: "", direction: 0 });
    window.addEventListener("popstate", historyNavigation);
    return () => window.removeEventListener("popstate", historyNavigation);
  }, []);

  useEffect(() => {
    const animation = animate(position, Math.max(0, selected), reduced ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 36 });
    return () => animation.stop();
  }, [position, reduced, selected]);

  useEffect(() => {
    // A route change or browser Back cancels a gesture that began on the old page.
    gesture.current = null;
    offset.set(0);
    const fromTabs = requestedTab.current === pathname;
    if (fromTabs) requestedTab.current = null;
    if (!fromTabs && !scrollPositions.current.has(pathname)) return;
    const desired = scrollPositions.current.get(pathname) ?? 0;
    const content = document.querySelector("[data-section-content]");
    if (!content || rootTabIndex(pathname) < 0) return;
    let done = false;
    const stop = () => {
      done = true;
      observer?.disconnect();
      window.removeEventListener("pointerdown", stop);
      window.removeEventListener("wheel", stop);
      window.removeEventListener("keydown", stop);
    };
    const restore = () => {
      if (done) return;
      window.scrollTo({ top: desired, behavior: "instant" });
      if (document.documentElement.scrollHeight - window.innerHeight >= desired) stop();
    };
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(restore);
    observer?.observe(content);
    window.addEventListener("pointerdown", stop, { passive: true });
    window.addEventListener("wheel", stop, { passive: true });
    window.addEventListener("keydown", stop);
    const frame = requestAnimationFrame(restore);
    const timeout = window.setTimeout(stop, 5000);
    return () => { stop(); cancelAnimationFrame(frame); clearTimeout(timeout); };
  }, [offset, pathname]);

  useEffect(() => {
    if (rootTabIndex(pathname) < 0) return;
    const rememberScroll = () => scrollPositions.current.set(pathname, window.scrollY);
    window.addEventListener("scroll", rememberScroll, { passive: true });
    return () => window.removeEventListener("scroll", rememberScroll);
  }, [pathname]);

  function navigate(href: string) {
    if (pending || href === pathname) return;
    const next = mainTabIndex(href);
    if (next < 0) return;
    if (rootTabIndex(pathname) >= 0) scrollPositions.current.set(pathname, window.scrollY);
    requestedTab.current = href;
    setIntent({ href, direction: Math.sign(next - index) });
    startNavigation(() => router.push(href, { scroll: false }));
  }

  function reset() {
    gesture.current = null;
    setHint(null);
    void animate(offset, 0, reduced ? { duration: 0 } : { type: "spring", stiffness: 450, damping: 38 });
    void animate(position, Math.max(0, index), reduced ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 36 });
  }

  function pointerDown(event: PointerEvent<HTMLDivElement>) {
    suppressClick.current = false;
    if (event.isPrimary === false) { reset(); return; }
    if (pending || event.button !== 0 || !(event.target instanceof Element)) return;
    const onTabs = Boolean(event.target.closest("[data-section-tabs]"));
    if ((!onTabs && rootTabIndex(pathname) < 0) || index < 0) return;
    if (event.pointerType === "mouse" && !onTabs) return;
    if (ownsGesture(event.target, event.currentTarget)) return;
    const width = document.documentElement.clientWidth;
    // Keep the screen edges available for the browser and OS Back gesture.
    if (!onTabs && (event.clientX < 24 || event.clientX > width - 24)) return;
    gesture.current = { id: event.pointerId, x: event.clientX, y: event.clientY, startedAt: event.timeStamp, horizontal: false, width };
  }

  function pointerMove(event: PointerEvent<HTMLDivElement>) {
    const start = gesture.current;
    if (!start || start.id !== event.pointerId) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (!start.horizontal) {
      if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) { reset(); return; }
      if (Math.abs(dx) < 10 || Math.abs(dx) < Math.abs(dy) * 1.35) return;
      start.horizontal = true;
      event.currentTarget.setPointerCapture?.(event.pointerId);
    }
    event.preventDefault();
    const next = index + (dx < 0 ? 1 : -1);
    const available = next >= 0 && next < MAIN_TABS.length;
    setHint(available ? next : null);
    offset.set(reduced ? 0 : Math.max(-72, Math.min(72, dx * (available ? 0.24 : 0.08))));
    position.set(Math.max(0, Math.min(MAIN_TABS.length - 1, index - dx / start.width)));
  }

  function pointerUp(event: PointerEvent<HTMLDivElement>) {
    const start = gesture.current;
    if (!start || start.id !== event.pointerId) return;
    const target = start.horizontal ? swipeTarget(index, event.clientX - start.x, event.clientY - start.y, event.timeStamp - start.startedAt, start.width) : null;
    suppressClick.current = start.horizontal;
    reset();
    if (target != null) navigate(MAIN_TABS[target].href);
  }

  return (
    <SectionContext.Provider value={{ index, selected, pending, direction: intent.direction, position, offset, navigate }}>
      <div className="app-shell flex min-h-dvh min-w-0 flex-col overflow-x-clip"
        onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={reset}
        onClickCapture={event => {
          if (suppressClick.current) { event.preventDefault(); event.stopPropagation(); suppressClick.current = false; }
        }}>
        {children}
        <AnimatePresence>
          {hint != null ? (
            <motion.div key={hint} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: reduced ? 0 : 0.12 }} aria-hidden="true"
              className={`pointer-events-none fixed top-1/2 z-30 flex items-center gap-2 rounded-full border border-border bg-card/95 px-3 py-2 text-xs font-medium text-primary shadow-sm ${hint > index ? "right-3" : "left-3"}`}>
              {hint < index ? <ArrowLeft className="size-4" /> : null}
              {MAIN_TABS[hint].label}
              {hint > index ? <ArrowRight className="size-4" /> : null}
            </motion.div>
          ) : null}
        </AnimatePresence>
        <span className="sr-only" role="status">{pending && intent.href ? `Открывается раздел «${MAIN_TABS[selected]?.label ?? ""}»` : ""}</span>
      </div>
    </SectionContext.Provider>
  );
}

export function SectionPages({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { direction, offset } = useSectionNavigation();
  const reduced = useReducedMotion();
  return (
    <motion.div data-section-content className="section-content flex-1 pb-36" style={{ x: offset, touchAction: rootTabIndex(pathname) >= 0 ? "pan-y pinch-zoom" : undefined }}>
      <AnimatePresence initial={false} mode="wait" custom={direction}>
        <motion.div key={pathname} custom={direction}
          variants={{
            enter: (way: number) => ({ opacity: reduced ? 1 : 0.45, x: reduced ? 0 : way * 28 }),
            visible: { opacity: 1, x: 0 },
            leave: (way: number) => ({ opacity: reduced ? 1 : 0.45, x: reduced ? 0 : -way * 20 }),
          }}
          initial="enter" animate="visible" exit="leave" transition={{ duration: reduced ? 0 : 0.16, ease: [0.22, 1, 0.36, 1] }}>
          {children}
        </motion.div>
      </AnimatePresence>
    </motion.div>
  );
}
