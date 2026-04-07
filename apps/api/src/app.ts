import Fastify from 'fastify';
import { config } from './config';
import { corsPlugin } from './plugins/cors';
import { authPlugin } from './plugins/auth';
import { registerRoutes } from './routes/index';

export async function buildApp() {
  const app = Fastify({
    logger: config.NODE_ENV !== 'test',
  });

  await app.register(corsPlugin);
  await app.register(authPlugin);
  await registerRoutes(app);

  return app;
}
