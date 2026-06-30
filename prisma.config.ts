// ============================================================
//  Prisma v7 configuration.
//  This tells Prisma where your database is, reading the secret
//  connection string from .env.local (DATABASE_URL).
// ============================================================
import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    // used by `prisma db push` / migrate to reach your database
  },
  datasource: {
    url: process.env.DATABASE_URL,
  },
});
