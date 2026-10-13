import { PrismaAdapter } from "@auth/prisma-adapter";
import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { getServerEnv } from "@/lib/env.server";
import { prisma } from "@/lib/prisma";

const env = getServerEnv();
const providers =
  env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
    ? [
        Google({
          clientId: env.GOOGLE_CLIENT_ID,
          clientSecret: env.GOOGLE_CLIENT_SECRET,
        }),
      ]
    : [];

export const { auth, signIn, signOut, handlers } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers,
  secret: env.AUTH_SECRET,
  session: {
    strategy: "database",
  },
  pages: {
    error: "/login",
  },
});
