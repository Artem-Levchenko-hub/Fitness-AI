/**
 * postgres.js bundled by Turbopack can receive Date values from a different
 * JavaScript realm and fail its instanceof-Date conversion. ISO text plus an
 * explicit PostgreSQL cast is realm-independent.
 */
export function postgresTimestampParameter(value: Date): string {
  return value.toISOString();
}
