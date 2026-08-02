const MAX_CAUSE_DEPTH = 4;

/** Достаёт PostgreSQL constraint_name из ошибки драйвера или обёртки ORM. */
export function getDatabaseConstraintName(error: unknown): string | null {
  let current = error;
  const seen = new Set<unknown>();

  for (let depth = 0; depth <= MAX_CAUSE_DEPTH; depth += 1) {
    if (typeof current !== "object" || current === null || seen.has(current)) {
      return null;
    }
    seen.add(current);

    const constraintName = (current as { constraint_name?: unknown })
      .constraint_name;
    if (typeof constraintName === "string" && constraintName.length > 0) {
      return constraintName;
    }

    current = (current as { cause?: unknown }).cause;
  }

  return null;
}
