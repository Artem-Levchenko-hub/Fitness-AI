/** Чистое IPv4/IPv6 CIDR-сопоставление. Без внешних зависимостей — безопасно
 *  юнит-тестировать (нет импорта env/db).
 *
 *  Извлечено из IP-allowlist ЮKassa-вебхука: его ПЕРВИЧНАЯ защита — HMAC-
 *  подпись у базовой интеграции не настроена, поэтому именно IP-фильтр решает,
 *  принять ли уведомление о платеже. Ошибка здесь = либо приём подделки, либо
 *  (хуже) отклонение реального уведомления → юзер заплатил, а credits не
 *  зачислены. Логика битовых масок легко ломается → покрыта тестами.
 *
 *  ЮKassa публикует и IPv4, и IPv6 диапазоны — оба обязаны работать. */

/** Парсит "a.b.c.d" в беззнаковое 32-битное число. Невалидный → null. */
export function ipv4ToNum(ip: string): number | null {
  const parts = ip.split(".").map((p) => parseInt(p, 10));
  if (parts.length !== 4 || parts.some((p) => isNaN(p) || p < 0 || p > 255)) {
    return null;
  }
  return (
    ((parts[0]! << 24) | (parts[1]! << 16) | (parts[2]! << 8) | parts[3]!) >>> 0
  );
}

/** Подходит ли ip под одну запись allowlist. Запись — либо CIDR
 *  (`base/prefix`), либо точный IP-литерал (без слэша → строгое равенство).
 *  IPv6 или мусор → false. */
export function ipv4InCidr(ip: string, cidr: string): boolean {
  if (!cidr.includes("/")) {
    return ip === cidr; // точный IP-литерал (напр. "77.75.156.11")
  }

  const [base, prefixStr] = cidr.split("/");
  if (!base || !prefixStr) return false;
  const prefix = parseInt(prefixStr, 10);
  if (isNaN(prefix) || prefix < 0 || prefix > 32) return false;

  // Эта функция сохраняет исторический IPv4-only контракт.
  if (ip.includes(":") || base.includes(":")) return false;

  const ipNum = ipv4ToNum(ip);
  const baseNum = ipv4ToNum(base);
  if (ipNum === null || baseNum === null) return false;

  const mask = prefix === 0 ? 0 : (~0 << (32 - prefix)) >>> 0;
  return (ipNum & mask) === (baseNum & mask);
}

/** Парсит канонический/сжатый IPv6 в 16 байт. Zone-id намеренно запрещён:
 *  webhook source — глобальный адрес, а не link-local интерфейс. */
export function ipv6ToBytes(ip: string): number[] | null {
  const normalized = ip.toLowerCase();
  if (!normalized || normalized.includes("%")) return null;
  if ((normalized.match(/::/g) ?? []).length > 1) return null;

  const hasCompression = normalized.includes("::");
  const [leftRaw, rightRaw = ""] = normalized.split("::");
  const left = leftRaw ? leftRaw.split(":") : [];
  const right = rightRaw ? rightRaw.split(":") : [];
  const valid = (part: string) => /^[0-9a-f]{1,4}$/.test(part);
  if (!left.every(valid) || !right.every(valid)) return null;

  if (!hasCompression && left.length !== 8) return null;
  const missing = 8 - left.length - right.length;
  if (hasCompression ? missing < 1 : missing !== 0) return null;

  const groups = [
    ...left,
    ...Array.from({ length: missing }, () => "0"),
    ...right,
  ];
  if (groups.length !== 8) return null;

  const bytes: number[] = [];
  for (const group of groups) {
    const value = Number.parseInt(group, 16);
    bytes.push((value >>> 8) & 0xff, value & 0xff);
  }
  return bytes;
}

export function ipv6InCidr(ip: string, cidr: string): boolean {
  if (!cidr.includes("/")) return ip.toLowerCase() === cidr.toLowerCase();

  const [base, prefixRaw] = cidr.split("/");
  if (!base || !prefixRaw) return false;
  const prefix = Number.parseInt(prefixRaw, 10);
  if (!Number.isInteger(prefix) || prefix < 0 || prefix > 128) return false;

  const addressBytes = ipv6ToBytes(ip);
  const baseBytes = ipv6ToBytes(base);
  if (!addressBytes || !baseBytes) return false;

  const fullBytes = Math.floor(prefix / 8);
  const remainingBits = prefix % 8;
  for (let index = 0; index < fullBytes; index += 1) {
    if (addressBytes[index] !== baseBytes[index]) return false;
  }
  if (remainingBits === 0) return true;

  const mask = (0xff << (8 - remainingBits)) & 0xff;
  return (
    (addressBytes[fullBytes]! & mask) === (baseBytes[fullBytes]! & mask)
  );
}

export function ipInCidr(ip: string, cidr: string): boolean {
  const isV6 = ip.includes(":") || cidr.includes(":");
  if (isV6) {
    if (!ip.includes(":") || !cidr.includes(":")) return false;
    return ipv6InCidr(ip, cidr);
  }
  return ipv4InCidr(ip, cidr);
}

/** Подходит ли ip хотя бы под одну запись allowlist. */
export function ipInAnyCidr(ip: string, cidrs: readonly string[]): boolean {
  for (const cidr of cidrs) {
    if (ipInCidr(ip, cidr)) return true;
  }
  return false;
}
