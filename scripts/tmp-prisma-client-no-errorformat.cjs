process.env.DATABASE_URL='postgresql://nextgen:nextgen123@localhost:5432/nextgen_marketplace?schema=public';
setTimeout(() => { console.error('GLOBAL_TIMEOUT'); process.exit(2); }, 15000);
const { PrismaClient } = require('@prisma/client');
(async () => {
  const prisma = new PrismaClient({ log: ['error','warn'] });
  console.log('NEW_OK');
  try {
    await prisma.$connect();
    console.log('CONNECT_OK');
    const rows = await prisma.$queryRaw`SELECT 1`;
    console.log('QUERY_OK', JSON.stringify(rows));
  } catch (e) {
    console.error('FAIL', e?.message || e);
  } finally {
    try { await prisma.$disconnect(); } catch {}
    process.exit(0);
  }
})();
