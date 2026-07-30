import { describe, expect, it } from "vitest";

import {
  ipInAnyCidr,
  ipv4InCidr,
  ipv4ToNum,
  ipv6InCidr,
  ipv6ToBytes,
} from "./cidr";

/** Характеризационные тесты IPv4/CIDR-сопоставления (allowlist ЮKassa-вебхука).
 *  Граничные кейсы (.31/.32 для /27, .127/.128 для /25) ловят off-by-one в
 *  битовой маске; 185.x-кейс пинит знаковую int32-тонкость JS-побитовых
 *  операций (high-bit set → отрицательный int32, но равенство сохраняется). */

describe("ipv4ToNum", () => {
  it("0.0.0.0 → 0", () => {
    expect(ipv4ToNum("0.0.0.0")).toBe(0);
  });

  it("255.255.255.255 → 4294967295 (макс беззнаковый)", () => {
    expect(ipv4ToNum("255.255.255.255")).toBe(4294967295);
  });

  it("185.71.76.5 → беззнаковое (high-bit set, не отрицательное)", () => {
    // 185<<24 даёт отрицательный int32 без >>>0 — проверяем беззнаковый итог
    expect(ipv4ToNum("185.71.76.5")).toBe(0xb9474c05);
  });

  it("слишком мало октетов → null", () => {
    expect(ipv4ToNum("1.2.3")).toBeNull();
  });

  it("слишком много октетов → null", () => {
    expect(ipv4ToNum("1.2.3.4.5")).toBeNull();
  });

  it("октет > 255 → null", () => {
    expect(ipv4ToNum("256.0.0.1")).toBeNull();
  });

  it("отрицательный октет → null", () => {
    expect(ipv4ToNum("-1.0.0.0")).toBeNull();
  });

  it("нечисловые октеты → null", () => {
    expect(ipv4ToNum("a.b.c.d")).toBeNull();
  });

  it("пустая строка → null", () => {
    expect(ipv4ToNum("")).toBeNull();
  });
});

describe("ipv4InCidr — границы маски", () => {
  it("/27: .5 внутри → true", () => {
    expect(ipv4InCidr("185.71.76.5", "185.71.76.0/27")).toBe(true);
  });

  it("/27: .31 (последний адрес блока) внутри → true", () => {
    expect(ipv4InCidr("185.71.76.31", "185.71.76.0/27")).toBe(true);
  });

  it("/27: .32 (первый за границей) снаружи → false", () => {
    expect(ipv4InCidr("185.71.76.32", "185.71.76.0/27")).toBe(false);
  });

  it("/27: другой /24-сосед снаружи → false", () => {
    expect(ipv4InCidr("185.71.77.5", "185.71.76.0/27")).toBe(false);
  });

  it("/25: .127 (последний адрес) внутри → true", () => {
    expect(ipv4InCidr("77.75.153.127", "77.75.153.0/25")).toBe(true);
  });

  it("/25: .128 (первый за границей) снаружи → false", () => {
    expect(ipv4InCidr("77.75.153.128", "77.75.153.0/25")).toBe(false);
  });

  it("/25 вторая половина: 77.75.154.200 внутри 77.75.154.128/25 → true", () => {
    expect(ipv4InCidr("77.75.154.200", "77.75.154.128/25")).toBe(true);
  });

  it("/25 вторая половина: .127 снаружи 77.75.154.128/25 → false", () => {
    expect(ipv4InCidr("77.75.154.127", "77.75.154.128/25")).toBe(false);
  });

  it("/32: совпадает только точный адрес", () => {
    expect(ipv4InCidr("1.2.3.4", "1.2.3.4/32")).toBe(true);
    expect(ipv4InCidr("1.2.3.5", "1.2.3.4/32")).toBe(false);
  });
});

describe("ipv4InCidr — точный IP-литерал (без слэша)", () => {
  it("точное совпадение → true", () => {
    expect(ipv4InCidr("77.75.156.11", "77.75.156.11")).toBe(true);
  });

  it("несовпадение → false", () => {
    expect(ipv4InCidr("77.75.156.12", "77.75.156.11")).toBe(false);
  });
});

describe("ipv4InCidr — невалидный вход", () => {
  it("IPv6-вход → false (v4-only)", () => {
    expect(ipv4InCidr("2a02:5180::1", "2a02:5180::/32")).toBe(false);
  });

  it("IPv6-база в CIDR → false", () => {
    expect(ipv4InCidr("1.2.3.4", "2a02:5180::/32")).toBe(false);
  });

  it("мусорный ip → false", () => {
    expect(ipv4InCidr("not-an-ip", "185.71.76.0/27")).toBe(false);
  });

  it("prefix вне диапазона → false (защитный гард)", () => {
    expect(ipv4InCidr("1.2.3.4", "1.2.3.4/33")).toBe(false);
  });
});

describe("ipInAnyCidr — против представительного allowlist", () => {
  // Подмножество реального YOOKASSA_IP_WHITELIST (живёт в lib/billing/yookassa.ts;
  // не импортируем сюда — тот модуль тянет env-валидацию). Инлайн = чистый тест.
  const ALLOW = [
    "185.71.76.0/27",
    "77.75.153.0/25",
    "77.75.156.11",
    "77.75.154.128/25",
    "2a02:5180::/32",
  ] as const;

  it("адрес в одном из CIDR → true", () => {
    expect(ipInAnyCidr("185.71.76.10", ALLOW)).toBe(true);
  });

  it("точный IP-литерал из списка → true", () => {
    expect(ipInAnyCidr("77.75.156.11", ALLOW)).toBe(true);
  });

  it("адрес во второй /25-половине → true", () => {
    expect(ipInAnyCidr("77.75.154.200", ALLOW)).toBe(true);
  });

  it("сторонний адрес → false", () => {
    expect(ipInAnyCidr("8.8.8.8", ALLOW)).toBe(false);
  });

  it("сосед мимо /27 → false", () => {
    expect(ipInAnyCidr("185.71.78.10", ALLOW)).toBe(false);
  });

  it("IPv6-адрес ЮKassa → true", () => {
    expect(ipInAnyCidr("2a02:5180::5", ALLOW)).toBe(true);
  });

  it("пустой список → false", () => {
    expect(ipInAnyCidr("185.71.76.10", [])).toBe(false);
  });
});

describe("IPv6 / CIDR", () => {
  it("парсит полный и сжатый адрес одинаково", () => {
    expect(ipv6ToBytes("2a02:5180::5")).toEqual(
      ipv6ToBytes("2a02:5180:0:0:0:0:0:5"),
    );
  });

  it("/32 принимает диапазон ЮKassa и отклоняет соседний", () => {
    expect(ipv6InCidr("2a02:5180:ffff::1", "2a02:5180::/32")).toBe(true);
    expect(ipv6InCidr("2a02:5181::1", "2a02:5180::/32")).toBe(false);
  });

  it("невалидный IPv6 и prefix отклоняются", () => {
    expect(ipv6ToBytes("2a02:::1")).toBeNull();
    expect(ipv6InCidr("2a02:5180::1", "2a02:5180::/129")).toBe(false);
  });
});
