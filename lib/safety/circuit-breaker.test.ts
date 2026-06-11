import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  CircuitOpenError,
  getCircuitState,
  resetCircuit,
  withCircuitBreaker,
} from "./circuit-breaker";

/**
 * Контракт breaker'а: open ТОЛЬКО после N ПОДРЯД идущих падений; успех
 * сбрасывает серию. REGISTRY — глобальный in-memory Map, поэтому каждый тест
 * берёт уникальное имя + resetCircuit, чтобы не делить состояние.
 */

const ok = () => Promise.resolve("ok");
const boom = () => Promise.reject(new Error("fail"));

describe("withCircuitBreaker", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-11T00:00:00Z"));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("REGRESSION: разрозненные падения с успехами между ними НЕ открывают breaker (порог = подряд, не суммарно)", async () => {
    const name = "repro-consecutive";
    resetCircuit(name);
    // fail, success, fail, success, fail — 3 падения суммарно, но НИ РАЗУ не подряд
    await expect(withCircuitBreaker(name, boom, { threshold: 3 })).rejects.toThrow("fail");
    await withCircuitBreaker(name, ok, { threshold: 3 });
    await expect(withCircuitBreaker(name, boom, { threshold: 3 })).rejects.toThrow("fail");
    await withCircuitBreaker(name, ok, { threshold: 3 });
    await expect(withCircuitBreaker(name, boom, { threshold: 3 })).rejects.toThrow("fail");
    // breaker остаётся CLOSED — успех каждый раз обнулял серию
    expect(getCircuitState(name).state).toBe("closed");
    expect(getCircuitState(name).failures).toBe(1);
    // следующий вызов реально доходит до fn (не fast-fail)
    await expect(withCircuitBreaker(name, ok, { threshold: 3 })).resolves.toBe("ok");
  });

  it("N падений ПОДРЯД открывают breaker", async () => {
    const name = "consecutive-open";
    resetCircuit(name);
    for (let i = 0; i < 3; i++) {
      await expect(withCircuitBreaker(name, boom, { threshold: 3 })).rejects.toThrow("fail");
    }
    expect(getCircuitState(name).state).toBe("open");
  });

  it("в состоянии open во время cooldown — fast-fail с CircuitOpenError, fn НЕ вызывается", async () => {
    const name = "open-fastfail";
    resetCircuit(name);
    for (let i = 0; i < 3; i++) {
      await withCircuitBreaker(name, boom, { threshold: 3, cooldownMs: 60_000 }).catch(() => {});
    }
    const fn = vi.fn(ok);
    await expect(
      withCircuitBreaker(name, fn, { threshold: 3, cooldownMs: 60_000 }),
    ).rejects.toBeInstanceOf(CircuitOpenError);
    expect(fn).not.toHaveBeenCalled();
  });

  it("после cooldown half-open пропускает один пробный вызов; успех → closed", async () => {
    const name = "halfopen-success";
    resetCircuit(name);
    for (let i = 0; i < 3; i++) {
      await withCircuitBreaker(name, boom, { threshold: 3, cooldownMs: 60_000 }).catch(() => {});
    }
    expect(getCircuitState(name).state).toBe("open");
    vi.advanceTimersByTime(60_000); // cooldown истёк
    await expect(
      withCircuitBreaker(name, ok, { threshold: 3, cooldownMs: 60_000 }),
    ).resolves.toBe("ok");
    expect(getCircuitState(name).state).toBe("closed");
    expect(getCircuitState(name).failures).toBe(0);
  });

  it("после cooldown half-open пробный вызов падает → снова open", async () => {
    const name = "halfopen-fail";
    resetCircuit(name);
    for (let i = 0; i < 3; i++) {
      await withCircuitBreaker(name, boom, { threshold: 3, cooldownMs: 60_000 }).catch(() => {});
    }
    vi.advanceTimersByTime(60_000);
    await expect(
      withCircuitBreaker(name, boom, { threshold: 3, cooldownMs: 60_000 }),
    ).rejects.toThrow("fail");
    expect(getCircuitState(name).state).toBe("open");
  });

  it("resetCircuit возвращает breaker в closed с нулевым счётчиком", async () => {
    const name = "reset";
    resetCircuit(name);
    for (let i = 0; i < 3; i++) {
      await withCircuitBreaker(name, boom, { threshold: 3 }).catch(() => {});
    }
    expect(getCircuitState(name).state).toBe("open");
    resetCircuit(name);
    expect(getCircuitState(name).state).toBe("closed");
    expect(getCircuitState(name).failures).toBe(0);
  });

  it("успешный вызов возвращает результат fn без изменений", async () => {
    const name = "passthrough";
    resetCircuit(name);
    await expect(withCircuitBreaker(name, () => Promise.resolve(42))).resolves.toBe(42);
  });
});
