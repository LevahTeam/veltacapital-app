import { config } from "dotenv";
import { prisma } from "../lib/prisma";

config({ path: ".env.local" });

function requiredAdminEmail() {
  const email = process.env.ADMIN_EMAIL;
  if (!email) {
    throw new Error("ADMIN_EMAIL is not set in your environment (.env.local).");
  }
  return email;
}

async function main() {
  console.log("DB URL present?", process.env.DATABASE_URL ? "yes" : "NO");
  const adminEmail = requiredAdminEmail();

  const user = await prisma.user.findFirst({
    where: { email: { equals: adminEmail, mode: "insensitive" } },
  });

  if (!user) {
    throw new Error(
      `No user found with email ${adminEmail}. Log into the site with that ` +
        "Google account at least once first, then run this again."
    );
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      plan: "premium",
      unlimitedSims: true,
      simRunsLeft: 0,
      canRedeem: true,
      earnMult: 1.5,
    },
  });

  console.log(`${updated.email} is now Premium with full access.`);
  console.log(
    `plan=${updated.plan}, unlimitedSims=${updated.unlimitedSims}, ` +
      `canRedeem=${updated.canRedeem}`
  );
}

try {
  await main();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
