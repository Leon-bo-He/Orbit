import Fastify from 'fastify';
import rateLimit from '@fastify/rate-limit';
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
  await app.register(rateLimit, {
    global: false, // only apply where explicitly configured
  });
  await registerRoutes(app);

  app.setErrorHandler((error, _request, reply) => {
    if (error.validation) {
      return reply.code(400).send({ error: 'Validation error', details: error.validation });
    }
    app.log.error(error);
    return reply.code(500).send({ error: 'Internal server error' });
  });

  app.setNotFoundHandler((request, reply) => {
    reply.code(404).send({ error: `Route ${request.method} ${request.url} not found` });
  });

  return app;
}
