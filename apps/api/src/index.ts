import { buildApp } from './app';
import { config } from './config';
import { redis } from './redis/client';
import { startWorkers } from './queue/workers';

async function main() {
  await redis.connect();
  const app = await buildApp();
  startWorkers();
  await app.listen({ port: config.PORT, host: '0.0.0.0' });
  console.log(`API running on port ${config.PORT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
