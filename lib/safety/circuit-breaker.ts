/** R-32 / R-33: circuit breaker для внешних AI-вызовов. После N подряд
 *  падений переключается в open — на cooldown отказывает быстро без сети,
 *  ровно один пробный запрос пропускает в half-open. Когда он проходит —
 *  closed снова. State per name (можно завести отдельные breakers для
 *  разных моделей/провайдеров). In-memory, переживает только пока процесс
 *  жив; этого достаточно — на старте все breakers closed. */
type State = "closed" | "open" | "half_open";

type BreakerState = {
  state: State;
  failures: number;
  openedAt: number;
};

const REGISTRY = new Map<string, BreakerState>();

export type CircuitBreakerOptions = {
  /** Кол-во подряд падений до перехода open. Default 3. */
  threshold?: number;
  /** Cooldown в ms перед half-open пробой. Default 60_000 (1 мин). */
  cooldownMs?: number;
};

export class CircuitOpenError extends Error {
  constructor(name: string, retryInMs: number) {
    super(
      `AI-сервис временно недоступен (${name}). Повторите через ${Math.ceil(retryInMs / 1000)} сек.`,
    );
    this.name = "CircuitOpenError";
  }
}

function getOrInit(name: string): BreakerState {
  let s = REGISTRY.get(name);
  if (!s) {
    s = { state: "closed", failures: 0, openedAt: 0 };
    REGISTRY.set(name, s);
  }
  return s;
}

export async function withCircuitBreaker<T>(
  name: string,
  fn: () => Promise<T>,
  opts: CircuitBreakerOptions = {},
): Promise<T> {
  const threshold = opts.threshold ?? 3;
  const cooldown = opts.cooldownMs ?? 60_000;
  const s = getOrInit(name);
  const now = Date.now();

  if (s.state === "open") {
    if (now - s.openedAt >= cooldown) {
      s.state = "half_open";
    } else {
      throw new CircuitOpenError(name, cooldown - (now - s.openedAt));
    }
  }

  try {
    const result = await fn();
    if (s.state !== "closed") {
      s.state = "closed";
      s.failures = 0;
    }
    return result;
  } catch (err) {
    s.failures += 1;
    if (s.failures >= threshold || s.state === "half_open") {
      s.state = "open";
      s.openedAt = now;
    }
    throw err;
  }
}

/** Для тестов и /admin/healthz. */
export function getCircuitState(name: string): Readonly<BreakerState> {
  return getOrInit(name);
}

export function resetCircuit(name: string): void {
  const s = getOrInit(name);
  s.state = "closed";
  s.failures = 0;
  s.openedAt = 0;
}
