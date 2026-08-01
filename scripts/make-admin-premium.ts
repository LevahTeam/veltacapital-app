// ============================================================
//  scripts/make-admin-premium.ts
//  One-time: grants the admin account (ADMIN_EMAIL) full Premium
//  access so the owner can use the whole member area without paying.
//
//  Run with:   npx tsx scripts/make-admin-premium.ts
//  (or)        npx ts-node scripts/make-admin-premium.ts
//
//  Safe to run more than once — it just re-sets the same fields.
// ============================================================
import { config } from "dotenv";
config({ path: ".env.local" });

console.log("DB URL present?", process.env.DATABASE_URL ? "yes" : "NO");

import { prisma } from "../lib/prisma";

async function main() {
  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail) {
    console.error("✗ ADMIN_EMAIL is not set in your environment (.env.local).");
    process.exit(1);
  }

  const user = await prisma.user.findFirst({
    where: { email: { equals: adminEmail, mode: "insensitive" } },
  });

  if (!user) {
    console.error(
      `✗ No user found with email ${adminEmail}.\n` +
      `  Log into the site with that Google account at least once first, ` +
      `then run this again.`
    );
    process.exit(1);
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      plan: "premium",
      unlimitedSims: true,
      simRunsLeft: 0,          // irrelevant when unlimitedSims is true
      canRedeem: true,
      earnMult: 1.5,
    },
  });

  console.log(`✓ ${updated.email} is now Premium with full access.`);
  console.log(`  plan=${updated.plan}, unlimitedSims=${updated.unlimitedSims}, canRedeem=${updated.canRedeem}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
