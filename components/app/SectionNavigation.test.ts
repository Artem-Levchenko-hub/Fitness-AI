// @vitest-environment jsdom
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const route = vi.hoisted(() => ({ pathname: "/dashboard", push: vi.fn() }));
vi.mock("next/navigation", () => ({ usePathname: () => route.pathname, useRouter: () => ({ push: route.push }) }));

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

function swipe(target: Element, dx: number, dy = 0) {
  const point = { pointerId: 1, pointerType: "touch", isPrimary: true, button: 0 };
  fireEvent.pointerDown(target, { ...point, clientX: 200, clientY: 200 });
  fireEvent.pointerMove(target, { ...point, clientX: 200 + dx, clientY: 200 + dy });
  fireEvent.pointerUp(target, { ...point, clientX: 200 + dx, clientY: 200 + dy });
}

function fixture() {
  return render(createElement(SectionNavigation, null,
    createElement("main", { "data-section-content": true },
      createElement("a", { href: "/create", "data-testid": "link" }, "Начать тренировку"),
      createElement("div", { "data-swipe-block": true, "data-testid": "model" }, "3D"),
      createElement("input", { "data-testid": "input" }),
    ),
    createElement("nav", { "data-section-tabs": true, "data-testid": "tabs" }, "Разделы"),
  ));
}

describe("section swipe integration", () => {
  beforeEach(() => {
    route.pathname = "/dashboard";
    route.push.mockClear();
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
    expect(fireEvent.click(link)).toBe(false);
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
