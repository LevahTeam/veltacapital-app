import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  session: { strategy: "database" },
  pages: {
    signIn: "/",        // your own page, not NextAuth's
    error: "/",         // errors bounce home too
  },
  callbacks: {
    async session({ session, user }) {
      if (session.user) (session.user as any).id = user.id;
      return session;
    },
  },
};
