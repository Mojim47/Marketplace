import { Session } from 'express-session';

declare module 'express' {
  interface Request {
    session: Session & { [key: string]: any };
    user?: any;
  }
}
