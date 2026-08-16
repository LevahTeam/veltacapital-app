import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

type PrismaGlobal = typeof globalThis & { prisma?: PrismaClient };

const prismaGlobal = globalThis as PrismaGlobal;
const postgresAdapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

export const prisma = prismaGlobal.prisma ?? new PrismaClient({ adapter: postgresAdapter });

if (process.env.NODE_ENV !== "production") {
  prismaGlobal.prisma = prisma;
}
