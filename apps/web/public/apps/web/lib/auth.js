import { login } from '@nextgen/auth';
import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
// Theorem: Identity is conserved across sessions iff entropy < threshold
const authConfig = {
  providers: [
    Credentials({
      // Axiom: Credentials are classical observables
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      authorize: async (creds) => {
        const email = creds?.email;
        const password = creds?.password;
        if (!email || !password) return null;
        try {
          // Lemma: login() is the ISO-compliant gateway anchored in libs/auth
          const user = await login(email, password);
          return user;
        } catch {
          return null;
        }
      },
    }),
  ],
  session: { strategy: 'jwt' },
  callbacks: {
    // Corollary: JWT encodes the identity tensor
    async jwt({ token, user }) {
      if (user) token.role = user.role;
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.role) {
        session.user.role = token.role;
      }
      return session;
    },
  },
};
export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);
//# sourceMappingURL=auth.js.map
