import { describe, expect, it } from "vitest";

import {
  DAILY_KEEP,
  WEEKLY_KEEP,
  parseBackupName,
  selectExpiredBackups,
} from "./retention";

const name = (date: string) => `fitness-${date}.sql.gz`;

describe("parseBackupName", () => {
  it("извлекает дату из валидного имени", () => {
    expect(parseBackupName("fitness-2026-06-12.sql.gz")).toBe("2026-06-12");
  });

  it("возвращает null для чужих имён", () => {
    expect(parseBackupName("fitness-2026-06-12.sql")).toBeNull();
    expect(parseBackupName("dump.sql.gz")).toBeNull();
    expect(parseBackupName("fitness-backup.sql.gz")).toBeNull();
    expect(parseBackupName("README.md")).toBeNull();
  });
});

describe("selectExpiredBackups", () => {
  const today = "2026-06-30";

  it("пустой каталог — нечего удалять", () => {
    expect(selectExpiredBackups([], today)).toEqual([]);
  });

  it("ровно 7 суточных — не удаляет ничего", () => {
    // 2026-06-24..30 (вт..пн), всего 7
    const files = [
      "2026-06-24",
      "2026-06-25",
      "2026-06-26",
      "2026-06-27",
      "2026-06-28",
      "2026-06-29",
      "2026-06-30",
    ].map(name);
    expect(selectExpiredBackups(files, today)).toEqual([]);
  });

  it("14 подряд суточных — оставляет 7 свежих + понедельники как недельные", () => {
    // 2026-06-15(пн)..28(вс) — 14 дней. Понедельники: 15, 22.
    const dates: string[] = [];
    for (let d = 15; d <= 28; d++) {
      dates.push(`2026-06-${String(d).padStart(2, "0")}`);
    }
    const files = dates.map(name);
    const deleted = selectExpiredBackups(files, "2026-06-28");

    // 7 свежих: 22..28. Среди старых 15..21 — понедельник 15 удержан как
    // недельный. Значит удаляются 16,17,18,19,20,21 (6 файлов).
    expect(deleted.sort()).toEqual(
      ["2026-06-16", "2026-06-17", "2026-06-18", "2026-06-19", "2026-06-20", "2026-06-21"].map(
        name,
      ),
    );
    expect(deleted).not.toContain(name("2026-06-15")); // понедельник жив
    expect(deleted).not.toContain(name("2026-06-22")); // в окне 7
  });

  it("недельные дампы старше 7-дневного окна удерживаются (до 4)", () => {
    // 7 свежих суточных + 6 старых понедельников. Должны выжить 4 свежайших пн.
    const recent = [
      "2026-06-24",
      "2026-06-25",
      "2026-06-26",
      "2026-06-27",
      "2026-06-28",
      "2026-06-29",
      "2026-06-30",
    ];
    const oldMondays = [
      "2026-06-22",
      "2026-06-15",
      "2026-06-08",
      "2026-06-01",
      "2026-05-25",
      "2026-05-18",
    ];
    const files = [...recent, ...oldMondays].map(name);
    const deleted = selectExpiredBackups(files, today);

    // 4 свежайших старых пн удержаны: 22,15,08,01 → удаляются 2 самых старых пн.
    expect(deleted.sort()).toEqual([name("2026-05-18"), name("2026-05-25")].sort());
  });

  it("игнорирует не-матчащие имена (чужое не трогаем)", () => {
    const files = [
      name("2026-01-01"),
      name("2026-01-02"),
      "random.sql.gz",
      "fitness-latest.tar",
      ".gitkeep",
    ];
    const deleted = selectExpiredBackups(files, today);
    expect(deleted).not.toContain("random.sql.gz");
    expect(deleted).not.toContain("fitness-latest.tar");
    expect(deleted).not.toContain(".gitkeep");
  });

  it("константы политики — 7 суточных + 4 недельных", () => {
    expect(DAILY_KEEP).toBe(7);
    expect(WEEKLY_KEEP).toBe(4);
  });
});
