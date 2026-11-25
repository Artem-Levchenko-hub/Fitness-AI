"use client";

import {
  animate,
  AnimatePresence,
  motion,
  type MotionValue,
  type Variants,
  useIsPresent,
  useMotionValue,
  usePresenceData,
  useReducedMotion,
} from "framer-motion";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { LayoutRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { usePathname, useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useRef,
  useState,
  useTransition,
  type PointerEvent,
  type ReactNode,
} from "react";

import { MAIN_TABS, mainTabIndex, rootTabIndex, swipeOffset, swipeTarget } from "@/lib/navigation/main-tabs";

type PageFrame = { element: HTMLDivElement; x: MotionValue<number> };
type PageSlide = { entry: number; exit: number; top: number; duration: number; fullWidth: boolean };
type NavigationIntent = { from: string; href: string; slide: PageSlide | null };
type SwipeRelease = { width: number; velocity: number };

const RETURN_SPRING = { type: "spring", stiffness: 410, damping: 38, mass: 0.9 } as const;
const TAB_SPRING = { type: "spring", stiffness: 400, damping: 35 } as const;
const SLIDE_EASE: [number, number, number, number] = [0.2, 0.78, 0.23, 1];

type Navigation = {
  index: number;
  selected: number;
  pending: boolean;
  position: MotionValue<number>;
  slide: PageSlide | null;
  registerFrame: (frame: PageFrame) => () => void;
  navigate: (href: string) => void;
};
const SectionContext = createContext<Navigation | null>(null);

export function useSectionNavigation(): Navigation {
  const navigation = useContext(SectionContext);
  if (!navigation) throw new Error("Section navigation needs the app shell");
  return navigation;
}

type Gesture = {
  id: number;
  x: number;
  y: number;
  width: number;
  horizontal: boolean;
  origin: number;
  lastX: number;
  lastAt: number;
  velocity: number;
  neighbor: number | null;
};
type WheelGesture = { lastAt: number; distance: number; handled: boolean };

function samplePointer(gesture: Gesture, event: PointerEvent<HTMLDivElement>) {
  const elapsed = event.timeStamp - gesture.lastAt;
  if (elapsed <= 0) return;
  const speed = (event.clientX - gesture.lastX) / elapsed;
  gesture.velocity = elapsed > 85 ? speed : gesture.velocity * 0.25 + speed * 0.75;
  gesture.lastX = event.clientX;
  gesture.lastAt = event.timeStamp;
}

function releaseVelocity(gesture: Gesture, event: PointerEvent<HTMLDivElement>): number {
  const elapsed = event.timeStamp - gesture.lastAt;
  if (elapsed >= 85) return 0;
  if (elapsed > 0 && Math.abs(event.clientX - gesture.lastX) >= 3) {
    return (event.clientX - gesture.lastX) / elapsed;
  }
  return gesture.velocity * (1 - Math.max(0, elapsed) / 85);
}

function isSwipeArea(target: Element, pathname: string): boolean {
  return Boolean(target.closest("[data-section-tabs]"))
    || (rootTabIndex(pathname) >= 0 && Boolean(target.closest("[data-section-content]")));
}

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
  const reduced = useReducedMotion() === true;
  const [pending, startNavigation] = useTransition();
  const [intent, setIntent] = useState<NavigationIntent | null>(null);
  const [hint, setHint] = useState<number | null>(null);
  const position = useMotionValue(Math.max(0, index));
  const activeFrame = useRef<PageFrame | null>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const gesture = useRef<Gesture | null>(null);
  const wheelGesture = useRef<WheelGesture | null>(null);
  const suppressClick = useRef(false);
  const scrollPositions = useRef(new Map<string, number>());
  const requestedTab = useRef<string | null>(null);
  const selected = pending && intent?.from === pathname ? mainTabIndex(intent.href) : index;
  const slide = intent?.href === pathname ? intent.slide : null;
  const preview = hint ?? (pending && intent?.from === pathname && intent.slide?.fullWidth ? selected : null);
  const registerFrame = useCallback((frame: PageFrame) => {
    activeFrame.current = frame;
    return () => {
      if (activeFrame.current === frame) activeFrame.current = null;
    };
  }, []);

  useEffect(() => {
    const historyNavigation = () => {
      activeFrame.current?.x.jump(0);
      setIntent(null);
      setHint(null);
    };
    window.addEventListener("popstate", historyNavigation);
    return () => window.removeEventListener("popstate", historyNavigation);
  }, []);

  useEffect(() => {
    const animation = animate(position, Math.max(0, selected), reduced ? { duration: 0 } : TAB_SPRING);
    return () => animation.stop();
  }, [position, reduced, selected]);

  useEffect(() => {
    // Each mounted page owns its translation. Keep the outgoing value until it slides out.
    gesture.current = null;
    shellRef.current?.removeAttribute("data-dragging-section");
    const fromTabs = requestedTab.current === pathname;
    requestedTab.current = null;
    const frame = requestAnimationFrame(() => {
      if (!gesture.current) setHint(null);
    });
    if (!fromTabs && !scrollPositions.current.has(pathname)) return () => cancelAnimationFrame(frame);
    const desired = scrollPositions.current.get(pathname) ?? 0;
    const content = document.querySelector("[data-section-content]");
    if (!content || rootTabIndex(pathname) < 0) return () => cancelAnimationFrame(frame);
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
    const scrollFrame = requestAnimationFrame(restore);
    const timeout = window.setTimeout(stop, 5000);
    return () => {
      stop();
      cancelAnimationFrame(frame);
      cancelAnimationFrame(scrollFrame);
      clearTimeout(timeout);
    };
  }, [pathname]);

  useEffect(() => {
    // A cancelled or failed router push should leave the current page centered.
    if (pending || intent?.from !== pathname || requestedTab.current !== intent.href) return;
    requestedTab.current = null;
    const x = activeFrame.current?.x;
    if (x && x.get() !== 0) void animate(x, 0, RETURN_SPRING);
  }, [intent, pathname, pending]);

  useEffect(() => {
    if (rootTabIndex(pathname) < 0) return;
    const rememberScroll = () => scrollPositions.current.set(pathname, window.scrollY);
    window.addEventListener("scroll", rememberScroll, { passive: true });
    return () => window.removeEventListener("scroll", rememberScroll);
  }, [pathname]);

  const handleWheel = useEffectEvent((event: WheelEvent, shell: HTMLElement) => {
    const { deltaMode, deltaX, deltaY, timeStamp, target } = event;
    if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey || index < 0) return;
    if (!(target instanceof Element) || !isSwipeArea(target, pathname)) return;
    if (deltaX === 0 || Math.abs(deltaX) < Math.abs(deltaY) * 1.35) {
      if (wheelGesture.current) wheelGesture.current.distance = 0;
      return;
    }
    if (ownsGesture(target, shell)) return;

    // Trackpad momentum is part of the original gesture, even after a route changes.
    if (!wheelGesture.current || timeStamp - wheelGesture.current.lastAt > 180) {
      wheelGesture.current = { lastAt: timeStamp, distance: 0, handled: false };
    }
    const current = wheelGesture.current;
    current.lastAt = timeStamp;
    const adjacent = index + Math.sign(deltaX);
    if (!current.handled && (adjacent < 0 || adjacent >= MAIN_TABS.length)) {
      current.distance = 0;
      return;
    }
    if (event.cancelable) event.preventDefault();
    if (current.handled || pending || gesture.current) return;

    const width = document.documentElement.clientWidth;
    const unit = deltaMode === 1 ? 16 : deltaMode === 2 ? width : 1;
    current.distance += deltaX * unit;
    const next = swipeTarget(index, -current.distance, 0, width);
    if (next == null) return;
    current.handled = true;
    navigate(MAIN_TABS[next].href);
  });

  useEffect(() => {
    const shell = shellRef.current;
    if (!shell) return;
    const onWheel = (event: WheelEvent) => handleWheel(event, shell);
    shell.addEventListener("wheel", onWheel, { passive: false });
    return () => shell.removeEventListener("wheel", onWheel);
  }, []);

  function navigate(href: string, release?: SwipeRelease) {
    if (pending || href === pathname) return;
    const next = mainTabIndex(href);
    if (next < 0) return;
    if (rootTabIndex(pathname) >= 0) scrollPositions.current.set(pathname, window.scrollY);
    const direction = Math.sign(next - index);
    const frame = activeFrame.current;
    const distance = release?.width ?? 48;
    const currentX = frame?.x.get() ?? 0;
    const entry = direction * distance + currentX;
    const duration = release
      ? Math.max(0.2, Math.min(0.34, Math.abs(entry) / (1450 + Math.abs(release.velocity) * 500)))
      : 0.2;
    requestedTab.current = href;
    setIntent({
      from: pathname,
      href,
      slide: reduced || direction === 0 || !frame ? null : {
        entry,
        exit: -direction * distance,
        top: frame.element.getBoundingClientRect().top,
        duration,
        fullWidth: release !== undefined,
      },
    });
    startNavigation(() => router.push(href, { scroll: false }));
  }

  function endGesture() {
    gesture.current = null;
    setHint(null);
    shellRef.current?.removeAttribute("data-dragging-section");
  }

  function cancelGesture() {
    const horizontal = gesture.current?.horizontal;
    endGesture();
    if (!horizontal) return;
    const x = activeFrame.current?.x;
    if (x) void animate(x, 0, reduced ? { duration: 0 } : RETURN_SPRING);
    void animate(position, Math.max(0, index), reduced ? { duration: 0 } : TAB_SPRING);
  }

  function pointerDown(event: PointerEvent<HTMLDivElement>) {
    suppressClick.current = false;
    if (gesture.current) cancelGesture();
    if (event.isPrimary === false) return;
    if (pending || event.defaultPrevented || event.button !== 0) return;
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    if (!(event.target instanceof Element) || index < 0 || !isSwipeArea(event.target, pathname)) return;
    const onTabs = Boolean(event.target.closest("[data-section-tabs]"));
    if (ownsGesture(event.target, event.currentTarget)) return;
    const width = document.documentElement.clientWidth || window.innerWidth;
    // Keep the screen edges available for the browser and OS Back gesture.
    if (!onTabs && (event.clientX < 24 || event.clientX > width - 24)) return;
    gesture.current = {
      id: event.pointerId, x: event.clientX, y: event.clientY, width, horizontal: false,
      origin: 0, lastX: event.clientX, lastAt: event.timeStamp, velocity: 0, neighbor: null,
    };
  }

  function pointerMove(event: PointerEvent<HTMLDivElement>) {
    const start = gesture.current;
    if (!start || start.id !== event.pointerId) return;
    if (event.pointerType === "mouse" && (event.buttons & 1) === 0) {
      cancelGesture();
      return;
    }
    samplePointer(start, event);
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (!start.horizontal) {
      if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) { cancelGesture(); return; }
      if (Math.abs(dx) < 10 || Math.abs(dx) < Math.abs(dy) * 1.35) return;
      start.horizontal = true;
      const x = activeFrame.current?.x;
      start.origin = x?.get() ?? 0;
      x?.stop();
      position.stop();
      event.currentTarget.setAttribute("data-dragging-section", "");
      if (event.pointerType === "mouse") window.getSelection()?.removeAllRanges();
      event.currentTarget.setPointerCapture?.(event.pointerId);
    }
    event.preventDefault();
    const next = index - Math.sign(dx);
    const neighbor = dx !== 0 && next >= 0 && next < MAIN_TABS.length ? next : null;
    if (neighbor !== start.neighbor) {
      start.neighbor = neighbor;
      setHint(neighbor);
      if (neighbor !== null && navigator.onLine) router.prefetch(MAIN_TABS[neighbor].href);
    }
    const moved = swipeOffset(dx, start.width, neighbor !== null);
    if (!reduced) activeFrame.current?.x.set(start.origin + moved);
    position.set(Math.max(0, Math.min(MAIN_TABS.length - 1, index - (reduced ? 0 : moved / start.width))));
  }

  function pointerUp(event: PointerEvent<HTMLDivElement>) {
    const start = gesture.current;
    if (!start || start.id !== event.pointerId) return;
    const velocity = releaseVelocity(start, event);
    const target = start.horizontal
      ? swipeTarget(index, event.clientX - start.x, event.clientY - start.y, start.width, velocity)
      : null;
    suppressClick.current = start.horizontal;
    if (target === null) {
      cancelGesture();
      return;
    }
    // Hold the released frame while Next loads. The same frame continues its slide on commit.
    endGesture();
    navigate(MAIN_TABS[target].href, { width: start.width, velocity });
  }

  return (
    <SectionContext.Provider value={{ index, selected, pending, position, slide, registerFrame, navigate }}>
      <div
        ref={shellRef}
        className="app-shell flex min-h-dvh min-w-0 flex-col overflow-x-clip data-[dragging-section]:select-none"
        onPointerDown={pointerDown}
        onPointerMove={pointerMove}
        onPointerUp={pointerUp}
        onPointerCancel={event => {
          if (gesture.current?.id === event.pointerId) cancelGesture();
        }}
        onLostPointerCapture={event => {
          if (event.target === event.currentTarget && gesture.current?.id === event.pointerId) cancelGesture();
        }}
        onDragStart={event => {
          if (gesture.current) event.preventDefault();
        }}
        onClickCapture={event => {
          if (suppressClick.current && event.detail > 0) {
            event.preventDefault();
            event.stopPropagation();
            suppressClick.current = false;
          }
        }}>
        {children}
        <AnimatePresence>
          {preview !== null ? (
            <motion.div key={preview} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: reduced ? 0 : 0.12 }} aria-hidden="true"
              className={`pointer-events-none fixed top-1/2 z-30 flex items-center gap-2 rounded-full border border-border bg-card/95 px-3 py-2 text-xs font-medium text-primary shadow-sm ${preview > index ? "right-3" : "left-3"}`}>
              {preview < index ? <ArrowLeft className="size-4" /> : null}
              {MAIN_TABS[preview].label}
              {preview > index ? <ArrowRight className="size-4" /> : null}
            </motion.div>
          ) : null}
        </AnimatePresence>
        <span className="sr-only" role="status">{pending && intent?.from === pathname ? `Открывается раздел «${MAIN_TABS[selected]?.label ?? ""}»` : ""}</span>
      </div>
    </SectionContext.Provider>
  );
}

export function SectionPages({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { slide } = useSectionNavigation();
  return (
    <div data-section-content className="section-content min-w-0 flex-1 pb-36" style={{ touchAction: rootTabIndex(pathname) >= 0 ? "pan-y pinch-zoom" : undefined }}>
      <AnimatePresence initial={false} custom={slide}>
        <SectionFrame key={pathname} slide={slide}>{children}</SectionFrame>
      </AnimatePresence>
    </div>
  );
}

const PAGE_VARIANTS: Variants = {
  enter: (slide: PageSlide | null) => ({
    x: slide?.entry ?? 0,
    opacity: slide?.fullWidth ? 1 : 0.86,
  }),
  visible: (slide: PageSlide | null) => ({
    x: 0, opacity: 1,
    transition: { type: "tween", duration: slide?.duration ?? 0.14, ease: SLIDE_EASE },
  }),
  leave: (slide: PageSlide | null) => ({
    x: slide?.exit ?? 0,
    opacity: slide?.fullWidth ? 1 : 0,
    transition: { type: "tween", duration: slide?.duration ?? 0, ease: SLIDE_EASE },
  }),
};

function SectionFrame({ children, slide }: { children: ReactNode; slide: PageSlide | null }) {
  const { registerFrame } = useSectionNavigation();
  const present = useIsPresent();
  const leaving = usePresenceData() as PageSlide | null;
  const routerContext = useContext(LayoutRouterContext);
  const [frameState, setFrameState] = useState({
    present, routerContext, exitTop: undefined as number | undefined,
  });
  const reduced = useReducedMotion() === true;
  const element = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);

  // App Router updates its live slot tree at commit, including inside retained
  // elements. Keep the source slot and its viewport position through the exit.
  if (present !== frameState.present || (present && routerContext !== frameState.routerContext)) {
    setFrameState({
      present,
      routerContext: present ? routerContext : frameState.routerContext,
      exitTop: present ? undefined : leaving?.top,
    });
  }

  useLayoutEffect(() => {
    if (present && element.current) return registerFrame({ element: element.current, x });
  }, [present, registerFrame, x]);

  return (
    <motion.div
      ref={element}
      data-section-page={present ? "active" : "leaving"}
      aria-hidden={!present || undefined}
      inert={!present || undefined}
      className={present ? "relative min-w-0" : "pointer-events-none fixed inset-x-0 z-10 min-w-0"}
      style={{ x, top: frameState.exitTop }}
      custom={slide}
      variants={PAGE_VARIANTS}
      initial={reduced ? false : "enter"}
      animate="visible"
      exit="leave"
    >
      <LayoutRouterContext.Provider value={present ? routerContext : frameState.routerContext}>
        {children}
      </LayoutRouterContext.Provider>
    </motion.div>
  );
}
