import { type DefaultSession, type NextAuthConfig } from "next-auth";
import DiscordProvider from "next-auth/providers/discord";
import Credentials from "next-auth/providers/credentials";
import { env } from "~/env";

/**
 * Module augmentation for `next-auth` types. Allows us to add custom properties to the `session`
 * object and keep type safety.
 *
 * @see https://next-auth.js.org/getting-started/typescript#module-augmentation
 */
declare module "next-auth" {
  interface Session extends DefaultSession {
    user: {
      id: string;
      // ...other properties
      // role: UserRole;
    } & DefaultSession["user"];
  }

  // interface User {
  //   // ...other properties
  //   // role: UserRole;
  // }
}

/**
 * Options for NextAuth.js used to configure adapters, providers, callbacks, etc.
 *
 * @see https://next-auth.js.org/configuration/options
 */
export const authConfig = {
  providers: [
    // Keep Discord available if env is configured; otherwise it will be ignored.
    DiscordProvider,
    Credentials({
      name: "Credentials",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials) => {
        const username = credentials?.username?.toString() ?? "";
        const password = credentials?.password?.toString() ?? "";

        if (username === env.AUTH_USERNAME && password === env.AUTH_PASSWORD) {
          return {
            id: "local-user",
            name: env.AUTH_USERNAME,
            email: `${env.AUTH_USERNAME}@local.example`,
          };
        }
        return null;
      },
    }),
  ],
  pages: {
    signIn: "/sign-in",
  },
  callbacks: {
    session: ({ session, token }) => ({
      ...session,
      user: {
        ...session.user,
        id: token.sub,
      },
    }),
    authorized: ({ auth, request }) => {
      const isSignedIn = !!auth?.user;
      const { pathname } = new URL(request.url);

      // Always allow NextAuth and static assets
      if (
        pathname.startsWith("/api/auth") ||
        pathname.startsWith("/_next") ||
        pathname.startsWith("/favicon") ||
        pathname.startsWith("/public")
      ) {
        return true;
      }

      // Allow access to sign-in page when not authenticated
      if (!isSignedIn && pathname === "/sign-in") return true;

      // Require auth for everything else
      return isSignedIn;
    },
  },
} satisfies NextAuthConfig;
