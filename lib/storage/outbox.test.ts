import { describe, expect, it } from "vitest";

import {
  type OutboxMutation,
  dedupeByClientId,
  dispatchOutboxChanged,
  makeClientId,
  OUTBOX_CHANGED_EVENT,
  parseOutbox,
  serializeOutbox,
  subscribeOutboxChanged,
} from "./outbox";

function mut(over: Partial<OutboxMutation> = {}): OutboxMutation {
  return {
    clientId: over.clientId ?? "c1",
    kind: "recordSet",
    payload: over.payload ?? { workoutExerciseId: "we1", setIndex: 0 },
    queuedAt: over.queuedAt ?? 1000,
  };
}

describe("outbox change event", () => {
  it("уведомляет UI об изменении очереди", () => {
    const target = new EventTarget();
    let calls = 0;
    target.addEventListener(OUTBOX_CHANGED_EVENT, () => {
      calls += 1;
    });

    dispatchOutboxChanged(target);

    expect(calls).toBe(1);
  });

  it("уведомляет другую вкладку через broadcast и снимает подписку", () => {
    const first = new EventTarget();
    const second = new EventTarget();
    const channel = (self: EventTarget, peer: EventTarget) => ({
      addEventListener: self.addEventListener.bind(self),
      removeEventListener: self.removeEventListener.bind(self),
      postMessage: () => peer.dispatchEvent(new Event("message")),
    });
    let calls = 0;
    const unsubscribe = subscribeOutboxChanged(
      () => {
        calls += 1;
      },
      null,
      channel(second, first),
    );

    dispatchOutboxChanged(null, channel(first, second));
    expect(calls).toBe(1);

    unsubscribe();
    dispatchOutboxChanged(null, channel(first, second));
    expect(calls).toBe(1);
  });
});

describe("makeClientId", () => {
  it("returns a unique UUID-shaped string each call", () => {
    const a = makeClientId();
    const b = makeClientId();
    expect(a).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
    expect(a).not.toBe(b);
  });
});

describe("serializeOutbox / parseOutbox", () => {
  it("round-trips a list of mutations", () => {
    const list = [mut({ clientId: "a" }), mut({ clientId: "b", queuedAt: 2000 })];
    expect(parseOutbox(serializeOutbox(list))).toEqual(list);
  });

  it("returns [] for null / empty input", () => {
    expect(parseOutbox(null)).toEqual([]);
    expect(parseOutbox("")).toEqual([]);
  });

  it("returns [] for corrupt JSON (fail-soft R-10)", () => {
    expect(parseOutbox("{not json")).toEqual([]);
  });

  it("returns [] when JSON is not an array", () => {
    expect(parseOutbox('{"clientId":"a"}')).toEqual([]);
  });

  it("drops invalid entries individually, keeps valid ones", () => {
    const valid = mut({ clientId: "ok" });
    const raw = JSON.stringify([
      valid,
      { clientId: "", kind: "recordSet", payload: {}, queuedAt: 1 }, // empty id
      { clientId: "x", kind: "bogus", payload: {}, queuedAt: 1 }, // bad kind
      { clientId: "y", kind: "recordSet", payload: null, queuedAt: 1 }, // no payload
      { clientId: "z", kind: "recordSet", payload: {}, queuedAt: NaN }, // bad ts
    ]);
    expect(parseOutbox(raw)).toEqual([valid]);
  });
});

describe("dedupeByClientId", () => {
  it("keeps the last write per clientId (later edit wins)", () => {
    const first = mut({ clientId: "dup", payload: { v: 1 } });
    const second = mut({ clientId: "dup", payload: { v: 2 } });
    expect(dedupeByClientId([first, second])).toEqual([second]);
  });

  it("preserves first-seen order across distinct ids", () => {
    const a = mut({ clientId: "a" });
    const b = mut({ clientId: "b" });
    const a2 = mut({ clientId: "a", payload: { v: 9 } });
    expect(dedupeByClientId([a, b, a2])).toEqual([a2, b]);
  });

  it("returns [] for empty input", () => {
    expect(dedupeByClientId([])).toEqual([]);
  });
});
