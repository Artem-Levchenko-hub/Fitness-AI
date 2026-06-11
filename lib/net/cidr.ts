/** Чистое IPv4 / CIDR-сопоставление. Без внешних зависимостей — безопасно
 *  юнит-тестировать (нет импорта env/db).
 *
 *  Извлечено из IP-allowlist ЮKassa-вебхука: его ПЕРВИЧНАЯ защита — HMAC-
 *  подпись у базовой интеграции не настроена, поэтому именно IP-фильтр решает,
 *  принять ли уведомление о платеже. Ошибка здесь = либо приём подделки, либо
 *  (хуже) отклонение реального уведомления → юзер заплатил, а credits не
 *  зачислены. Логика битовых масок легко ломается → покрыта тестами.
 *
 *  IPv4-only: наша инфра — v4, nginx подставляет v4 в X-Forwarded-For.
 *  IPv6-вход → false (известное ограничение, см. тесты). */

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

  // IPv4 only — для IPv6 пропускаем (наша инфра v4)
  if (ip.includes(":") || base.includes(":")) return false;

  const ipNum = ipv4ToNum(ip);
  const baseNum = ipv4ToNum(base);
  if (ipNum === null || baseNum === null) return false;

  const mask = prefix === 0 ? 0 : (~0 << (32 - prefix)) >>> 0;
  return (ipNum & mask) === (baseNum & mask);
}

/** Подходит ли ip хотя бы под одну запись allowlist. */
export function ipInAnyCidr(ip: string, cidrs: readonly string[]): boolean {
  for (const cidr of cidrs) {
    if (ipv4InCidr(ip, cidr)) return true;
  }
  return false;
}
