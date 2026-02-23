setTimeout(() => { console.error('GLOBAL_TIMEOUT'); process.exit(2); }, 8000);
console.log('before require');
process.env.DATABASE_URL='postgresql://nextgen:nextgen123@localhost:5432/nextgen_marketplace?schema=public';
const { PrismaService } = require('../dist/apps/api/src/database/prisma.service.js');
console.log('after require');
(async () => {
  console.log('before new');
  const prisma = new PrismaService();
  console.log('constructed');
  try {
    const result = await Promise.race([
      prisma.$queryRaw`SELECT 1`,
      new Promise((_,rej)=>setTimeout(()=>rej(new Error('timeout')),5000))
    ]);
    console.log('OK', JSON.stringify(result));
  } catch (e) {
    console.error('FAIL', e.message);
  } finally {
    await prisma.$disconnect();
    console.log('done');
    process.exit(0);
  }
})();
