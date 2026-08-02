/**
 * Повторяет базовое поведение dotenv для значений в одинарных/двойных
 * кавычках. PM2-конфиг читает .env сам, поэтому кавычки нельзя передавать
 * приложению как часть EMAIL_FROM или другого значения.
 */
function parseEnvValue(rawValue) {
  if (rawValue.length < 2) return rawValue;

  const first = rawValue[0];
  const last = rawValue.at(-1);
  if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
    return rawValue.slice(1, -1);
  }

  return rawValue;
}

module.exports = { parseEnvValue };
