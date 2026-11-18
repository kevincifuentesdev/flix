import "dotenv/config";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is not set in environment variables");
}

const isNonSslDatabase =
  databaseUrl.includes("localhost") ||
  databaseUrl.includes("127.0.0.1") ||
  databaseUrl.includes("@db:") ||
  databaseUrl.includes("@flix-postgres:") ||
  databaseUrl.includes(".svc.cluster.local") ||
  /[?&]sslmode=disable/i.test(databaseUrl);

export const pgsql = new Pool({
  connectionString: databaseUrl,
  ssl: isNonSslDatabase ? false : { rejectUnauthorized: false },
});

export const db = drizzle({ client: pgsql });
