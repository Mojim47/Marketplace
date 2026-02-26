process.env.DATABASE_URL='postgresql://nextgen:nextgen123@localhost:5432/nextgen_marketplace?schema=public';
setTimeout(() => { console.error('GLOBAL_TIMEOUT'); process.exit(2); }, 15000);
const { PrismaClient } = require('@prisma/client');
(async () => {
  const prisma = new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query','info','warn','error'] : ['warn','error'],
    errorFormat: 'pretty',
  });
  console.log('NEW_OK');
  try {
    await prisma.$connect();
    console.log('CONNECT_OK');
    const rows = await Promise.race([
      prisma.$queryRaw`SELECT 1`,
      new Promise((_, rej) => setTimeout(()=>rej(new Error('query_timeout')), 6000)),
    ]);
    console.log('QUERY_OK', JSON.stringify(rows));
  } catch (e) {
    console.error('FAIL', e?.message || e);
  } finally {
    try { await prisma.$disconnect(); } catch {}
    process.exit(0);
  }
})();
