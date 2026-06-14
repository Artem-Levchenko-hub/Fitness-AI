import { describe, expect, it } from "vitest";

import {
  selectFriendGroupAggregate,
  type FriendGroupDatum,
} from "./friend-group-aggregate";

const DATA: FriendGroupDatum[] = [
  {
    key: "chest",
    label: "Грудь",
    sets: 9,
    volume7d: 4200,
    levelLabel: "Хорошо нагружена",
  },
  {
    key: "quads",
    label: "Квадрицепсы",
    sets: 0,
    volume7d: 0,
    levelLabel: "Холодная",
  },
];

describe("selectFriendGroupAggregate", () => {
  it("совпадение по ключу → агрегат группы (label/sets/volume7d/levelLabel)", () => {
    expect(selectFriendGroupAggregate(DATA, "chest")).toEqual({
      label: "Грудь",
      sets: 9,
      volume7d: 4200,
      levelLabel: "Хорошо нагружена",
    });
  });

  it("группа с нулевой нагрузкой всё равно возвращается (0 подходов — валидный агрегат)", () => {
    expect(selectFriendGroupAggregate(DATA, "quads")).toEqual({
      label: "Квадрицепсы",
      sets: 0,
      volume7d: 0,
      levelLabel: "Холодная",
    });
  });

  it("ключ не из набора (друг не тренировал группу → её нет в heat) → null (R-37)", () => {
    expect(selectFriendGroupAggregate(DATA, "glutes")).toBeNull();
  });

  it("пустые данные → null", () => {
    expect(selectFriendGroupAggregate([], "chest")).toBeNull();
  });
});
