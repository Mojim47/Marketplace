const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient({ log: ['error','warn'] });
const t = Date.now();
setTimeout(() => { console.log('HANG', Date.now() - t); process.exit(2); }, 60000);
(async()=>{
  try {
    await p.$connect();
    console.log('CONNECT_OK', Date.now() - t);
    const r = await p.$queryRaw`SELECT 1`;
    console.log('QUERY_OK', Date.now() - t, JSON.stringify(r));
  } catch (e) {
    console.error('ERR', Date.now() - t, e?.message || e);
    process.exitCode = 1;
  } finally {
    try { await p.$disconnect(); } catch {}
  }
})();
setInterval(()=>{},1000);
