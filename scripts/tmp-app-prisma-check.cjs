process.on('unhandledRejection', (e)=>console.error('UNHANDLED', e?.message || e));
setTimeout(() => { console.error('GLOBAL_TIMEOUT'); process.exit(2); }, 25000);

const { NestFactory } = require('@nestjs/core');
const { LaunchAppModule } = require('../dist/apps/api/src/app.launch.module.js');
const { PrismaService } = require('../dist/apps/api/src/database/prisma.service.js');

(async () => {
  console.log('ENV_DB', process.env.DATABASE_URL || 'unset');
  console.log('ENV_REDIS', process.env.REDIS_URL || 'unset');
  const app = await NestFactory.create(LaunchAppModule, { logger: ['error','warn','log'], abortOnError:false });
  console.log('APP_CREATED');
  const prisma = app.get(PrismaService);
  console.log('PRISMA_DS', prisma?._engineConfig?.datasources?.db?.url || prisma?._engineConfig?.datasourceUrl || 'unset');
  try {
    await Promise.race([
      prisma.$queryRaw`SELECT 1`,
      new Promise((_, rej) => setTimeout(() => rej(new Error('query_timeout')), 9000))
    ]);
    console.log('QUERY_OK');
  } catch (e) {
    console.error('QUERY_FAIL', e?.message || e);
  }
  try { await app.close(); } catch {}
  process.exit(0);
})();
