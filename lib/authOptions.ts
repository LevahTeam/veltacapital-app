import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";

const googleProvider = GoogleProvider({
  clientId: process.env.GOOGLE_CLIENT_ID!,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
  allowDangerousEmailAccountLinking: true,
});

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [googleProvider],
  session: { strategy: "database" },
  pages: { signIn: "/" },
  callbacks: {
    async session({ session, user }) {
      if (session.user !== undefined) {
        session.user.id = user.id;
      }
      return session;
    },
  },
};
