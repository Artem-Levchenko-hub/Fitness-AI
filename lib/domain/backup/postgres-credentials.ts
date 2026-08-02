export type PgDumpConnection = Readonly<{
  host: string;
  port: string;
  database: string;
  user: string;
  password: string;
  sslMode?: string;
}>;

const SSL_MODES = new Set([
  "disable",
  "allow",
  "prefer",
  "require",
  "verify-ca",
  "verify-full",
]);

export function parsePgDumpConnection(databaseUrl: string): PgDumpConnection {
  let url: URL;
  try {
    url = new URL(databaseUrl);
  } catch {
    throw new TypeError("DATABASE_URL is not a valid URL");
  }
  if (url.protocol !== "postgres:" && url.protocol !== "postgresql:") {
    throw new TypeError("DATABASE_URL must use postgres protocol");
  }

  const database = decodeURIComponent(url.pathname.replace(/^\//, ""));
  const user = decodeURIComponent(url.username);
  const password = decodeURIComponent(url.password);
  if (!url.hostname || !database || !user || !password) {
    throw new TypeError("DATABASE_URL is missing connection credentials");
  }

  const requestedSslMode = url.searchParams.get("sslmode") ?? undefined;
  if (requestedSslMode && !SSL_MODES.has(requestedSslMode)) {
    throw new TypeError("DATABASE_URL has unsupported sslmode");
  }

  return {
    host: url.hostname,
    port: url.port || "5432",
    database,
    user,
    password,
    sslMode: requestedSslMode,
  };
}

function escapePgPassField(value: string): string {
  return value.replaceAll("\\", "\\\\").replaceAll(":", "\\:");
}

export function buildPgPassLine(connection: PgDumpConnection): string {
  return [
    connection.host,
    connection.port,
    connection.database,
    connection.user,
    connection.password,
  ]
    .map(escapePgPassField)
    .join(":");
}
