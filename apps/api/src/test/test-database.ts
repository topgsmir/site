const TEST_DATABASE_NAME = /(?:^|[_-])test(?:$|[_-])/i;

interface TestDatabaseEnvironment {
  DATABASE_URL?: string;
  NODE_ENV?: string;
}

export function assertDedicatedTestDatabase(
  environment: TestDatabaseEnvironment = {
    DATABASE_URL: process.env.DATABASE_URL,
    NODE_ENV: process.env.NODE_ENV
  }
): void {
  if (environment.NODE_ENV !== "test") {
    throw new Error("Integration tests require NODE_ENV=test");
  }

  const databaseUrl = environment.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error(
      "Integration tests require DATABASE_URL to point to a dedicated test database"
    );
  }

  let parsed: URL;
  try {
    parsed = new URL(databaseUrl);
  } catch {
    throw new Error("Integration tests require a valid PostgreSQL DATABASE_URL");
  }

  if (parsed.protocol !== "postgresql:" && parsed.protocol !== "postgres:") {
    throw new Error("Integration tests require a PostgreSQL DATABASE_URL");
  }

  const databaseName = decodeURIComponent(parsed.pathname.replace(/^\//, ""));
  if (!TEST_DATABASE_NAME.test(databaseName)) {
    throw new Error(
      `Refusing to run integration tests against non-test database ${JSON.stringify(databaseName)}`
    );
  }
}
