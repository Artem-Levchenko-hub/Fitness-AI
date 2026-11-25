// @vitest-environment jsdom
import { cleanup, createEvent, fireEvent, render, waitFor } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const route = vi.hoisted(() => ({ pathname: "/dashboard", push: vi.fn(), prefetch: vi.fn() }));
vi.mock("next/navigation", () => ({
  usePathname: () => route.pathname,
  useRouter: () => ({ push: route.push, prefetch: route.prefetch }),
}));

import { SectionNavigation } from "./SectionNavigation";

class TestPointerEvent extends MouseEvent {
  pointerId: number;
  pointerType: string;
  isPrimary: boolean;
  constructor(type: string, options: PointerEventInit = {}) {
    super(type, options);
    this.pointerId = options.pointerId ?? 1;
    this.pointerType = options.pointerType ?? "touch";
    this.isPrimary = options.isPrimary ?? true;
  }
}

function swipe(target: Element, dx: number, dy = 0, pointerType = "touch") {
  const point = { pointerId: 1, pointerType, isPrimary: true, button: 0, buttons: 1 };
  fireEvent.pointerDown(target, { ...point, clientX: 200, clientY: 200 });
  fireEvent.pointerMove(target, { ...point, clientX: 200 + dx, clientY: 200 + dy });
  fireEvent.pointerUp(target, { ...point, buttons: 0, clientX: 200 + dx, clientY: 200 + dy });
}

function page() {
  return createElement(SectionNavigation, null,
    createElement("main", { "data-section-content": true },
      createElement("a", { href: "/create", "data-testid": "link" }, "Начать тренировку"),
      createElement("div", { "data-swipe-block": true, "data-testid": "model" }, "3D"),
      createElement("input", { "data-testid": "input" }),
    ),
    createElement("nav", { "data-section-tabs": true, "data-testid": "tabs" }, "Разделы"),
  );
}

function fixture() {
  return render(page());
}

function wheel(target: Element, deltaX: number, deltaY: number, timeStamp: number) {
  const event = createEvent.wheel(target, { deltaX, deltaY, cancelable: true });
  Object.defineProperty(event, "timeStamp", { value: timeStamp });
  return fireEvent(target, event);
}

function timedPointer(target: Element, type: string, x: number, at: number) {
  const event = new TestPointerEvent(type, { bubbles: true, cancelable: true, buttons: type === "pointerup" ? 0 : 1, clientX: x, clientY: 180 });
  Object.defineProperty(event, "timeStamp", { value: at });
  fireEvent(target, event);
}

describe("section swipe integration", () => {
  beforeEach(() => {
    route.pathname = "/dashboard";
    route.push.mockClear();
    route.prefetch.mockClear();
    vi.stubGlobal("PointerEvent", TestPointerEvent);
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => setTimeout(() => callback(0), 0));
    vi.stubGlobal("cancelAnimationFrame", clearTimeout);
    Object.defineProperty(window, "matchMedia", { configurable: true, value: () => ({
      matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn(), addListener: vi.fn(), removeListener: vi.fn(),
    }) });
    vi.spyOn(document.documentElement, "clientWidth", "get").mockReturnValue(390);
    vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  });
  afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

  it("navigates once and suppresses the link click after a horizontal gesture", () => {
    const view = fixture();
    const link = view.getByTestId("link");
    swipe(link, -90);
    expect(route.push).toHaveBeenCalledExactlyOnceWith("/workouts", { scroll: false });
    expect(fireEvent.click(link, { detail: 1 })).toBe(false);
  });

  it("uses the last movement for a flick that begins after a hold", () => {
    const link = fixture().getByTestId("link");
    timedPointer(link, "pointerdown", 200, 1000);
    timedPointer(link, "pointermove", 190, 1460);
    timedPointer(link, "pointermove", 160, 1480);
    timedPointer(link, "pointerup", 160, 1490);
    expect(route.prefetch).toHaveBeenCalledExactlyOnceWith("/workouts");
    expect(route.push).toHaveBeenCalledExactlyOnceWith("/workouts", { scroll: false });
  });

  it("settles a short swipe when the finger has stopped before release", () => {
    const link = fixture().getByTestId("link");
    timedPointer(link, "pointerdown", 200, 1000);
    timedPointer(link, "pointermove", 160, 1030);
    timedPointer(link, "pointerup", 160, 1160);
    expect(route.push).not.toHaveBeenCalled();
  });

  it("leaves keyboard activation available after a drag without a click", () => {
    const link = fixture().getByTestId("link");
    link.setAttribute("href", "#start");
    swipe(link, -90);
    expect(fireEvent.click(link, { detail: 0 })).toBe(true);
  });

  it.each([
    ["/dashboard", -100, "/workouts"],
    ["/workouts", -100, "/stats"],
    ["/stats", 100, "/workouts"],
    ["/workouts", 100, "/dashboard"],
  ])("accepts a mouse drag over the content of %s", (from, dx, to) => {
    route.pathname = from;
    const view = fixture();
    swipe(view.getByTestId("link"), dx, 0, "mouse");
    expect(route.push).toHaveBeenCalledExactlyOnceWith(to, { scroll: false });
  });

  it("lets the page swipe handle win over a browser link drag", () => {
    const view = fixture();
    const link = view.getByTestId("link");
    fireEvent.pointerDown(link, { pointerType: "mouse", buttons: 1, clientX: 200 });
    expect(fireEvent.dragStart(link)).toBe(false);
  });

  it("moves one section per horizontal wheel gesture even after the route changes", () => {
    const view = fixture();
    const link = view.getByTestId("link");
    wheel(link, 35, 3, 1000);
    expect(route.push).not.toHaveBeenCalled();
    wheel(link, 45, 3, 1030);
    expect(route.push).toHaveBeenCalledExactlyOnceWith("/workouts", { scroll: false });

    route.pathname = "/workouts";
    view.rerender(page());
    wheel(link, 120, 0, 1080);
    expect(route.push).toHaveBeenCalledTimes(1);
    wheel(link, -100, 0, 1350);
    expect(route.push).toHaveBeenLastCalledWith("/dashboard", { scroll: false });
  });

  it("keeps vertical scrolling and wheel gestures inside protected content", () => {
    const view = fixture();
    expect(wheel(view.getByTestId("link"), 35, 100, 1000)).toBe(true);
    expect(wheel(view.getByTestId("model"), 120, 0, 1250)).toBe(true);
    expect(route.push).not.toHaveBeenCalled();
  });

  it("leaves vertical scroll, form controls and the model alone", () => {
    const view = fixture();
    swipe(view.getByTestId("link"), -20, 100);
    swipe(view.getByTestId("model"), -100);
    swipe(view.getByTestId("input"), -100);
    expect(route.push).not.toHaveBeenCalled();
  });

  it("does not leave a detail page, but allows its bottom navigation swipe", () => {
    route.pathname = "/workouts/current";
    const view = fixture();
    swipe(view.getByTestId("link"), -100);
    expect(route.push).not.toHaveBeenCalled();
    swipe(view.getByTestId("tabs"), -100);
    expect(route.push).toHaveBeenCalledExactlyOnceWith("/stats", { scroll: false });
  });

  it("cancels when the pointer stream is interrupted", () => {
    const view = fixture();
    const link = view.getByTestId("link");
    fireEvent.pointerDown(link, { clientX: 200, clientY: 200 });
    fireEvent.pointerMove(link, { clientX: 100, clientY: 200 });
    fireEvent.pointerCancel(link);
    fireEvent.pointerUp(link, { clientX: 90, clientY: 200 });
    expect(route.push).not.toHaveBeenCalled();
  });

  it("keeps a touch gesture when a child gives up implicit pointer capture", () => {
    const view = fixture();
    const link = view.getByTestId("link");
    fireEvent.pointerDown(link, { clientX: 200, clientY: 200 });
    fireEvent.pointerMove(link, { clientX: 90, clientY: 200 });
    fireEvent.lostPointerCapture(link, { bubbles: true });
    fireEvent.pointerUp(link, { clientX: 80, clientY: 200 });
    expect(route.push).toHaveBeenCalledExactlyOnceWith("/workouts", { scroll: false });
  });

  it("leaves browser Back restoration alone when the root was not visited", () => {
    route.pathname = "/workouts/current";
    const view = fixture();
    route.pathname = "/workouts";
    view.rerender(createElement(SectionNavigation, null, createElement("main", { "data-section-content": true }, "Тренировки")));
    expect(window.scrollTo).not.toHaveBeenCalled();
  });

  it("remembers root scrolling even when a normal detail link is used", async () => {
    const view = fixture();
    vi.spyOn(window, "scrollY", "get").mockReturnValue(320);
    fireEvent.scroll(window);
    route.pathname = "/settings";
    view.rerender(createElement(SectionNavigation, null, createElement("main", null, "Настройки")));
    route.pathname = "/dashboard";
    view.rerender(createElement(SectionNavigation, null, createElement("main", { "data-section-content": true }, "Главная")));
    await waitFor(() => expect(window.scrollTo).toHaveBeenCalledWith({ top: 320, behavior: "instant" }));
  });
});
