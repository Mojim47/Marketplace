import { PrismaClient } from '@prisma/client';

declare global {
  // eslint-disable-next-line no-var
  // eslint-disable-next-line no-unused-vars
  var __nextgenPrisma: PrismaClient | undefined;
}

export const prisma = global.__nextgenPrisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  global.__nextgenPrisma = prisma;
}
