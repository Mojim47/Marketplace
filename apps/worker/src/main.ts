import { NestFactory } from '@nestjs/core';
import { loadEnvFiles, validateEnv } from '@nextgen/config';
import { WorkerModule } from './worker.module';

async function bootstrap() {
  loadEnvFiles();
  validateEnv({ service: 'worker' });

  const app = await NestFactory.create(WorkerModule);
  await app.listen(process.env.PORT ?? 3000);
}

bootstrap();
