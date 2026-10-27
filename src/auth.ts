import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { findUserByEmail, upsertOAuthUser, verifyPassword } from "@/lib/auth/users";

export const { handlers, auth, signIn, signOut } = NextAuth({
  pages: { signIn: "/login" },
  session: { strategy: "jwt" },
  providers: [
    Google({ clientId: process.env.GOOGLE_CLIENT_ID, clientSecret: process.env.GOOGLE_CLIENT_SECRET }),
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(credentials) {
        const email = typeof credentials?.email === "string" ? credentials.email : "";
        const password = typeof credentials?.password === "string" ? credentials.password : "";
        if (!email || !password) return null;
        const user = await findUserByEmail(email);
        if (!user || !(await verifyPassword(user, password))) return null;
        return { id: user.id, name: user.name, email: user.email, image: user.image };
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === "google" && user.email) {
        await upsertOAuthUser(user.email, user.name ?? null, user.image ?? null);
      }
      return true;
    },
    async jwt({ token, user, trigger, session }) {
      if (user) token.id = user.id;
      if (trigger === "update" && session && typeof session === "object") {
        const patch = session as Partial<{ name: string; image: string }>;
        if (typeof patch.name === "string") token.name = patch.name;
        if (typeof patch.image === "string") token.picture = patch.image;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && typeof token.id === "string") session.user.id = token.id;
      return session;
    },
  },
});
