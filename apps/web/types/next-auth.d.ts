import type { DefaultSession } from 'next-auth';
import type { DefaultJWT } from 'next-auth/jwt';

declare module 'next-auth' {
  interface Session extends DefaultSession {
    user: DefaultSession['user'] extends never
      ? { role?: string; organizationId?: string }
      : DefaultSession['user'] & { role?: string; organizationId?: string };
  }

  interface User {
    role?: string;
    organizationId?: string;
  }
}

declare module 'next-auth/jwt' {
  interface JWT extends DefaultJWT {
    role?: string;
  }
}
