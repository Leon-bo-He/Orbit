import Fastify from 'fastify';
import rateLimit from '@fastify/rate-limit';
import multipart from '@fastify/multipart';
import staticFiles from '@fastify/static';
import { ZodError } from 'zod';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOADS_ROOT = path.join(__dirname, '../uploads');
import { config } from './config.js';
import { corsPlugin } from './interfaces/http/plugins/cors.js';
import { authPlugin } from './interfaces/http/plugins/auth.js';
import { registerRoutes } from './interfaces/http/routes/index.js';
import { NotFoundError, ForbiddenError, ConflictError, ValidationError } from './domain/errors.js';

// Domain services
import { WorkspaceService } from './domain/workspace/workspace.service.js';
import { ContentService } from './domain/content/content.service.js';
import { IdeaService } from './domain/idea/idea.service.js';
import { PublicationService } from './domain/publication/publication.service.js';
import { PlanService } from './domain/plan/plan.service.js';
import { MetricService } from './domain/metric/metric.service.js';
import { UserService } from './domain/user/user.service.js';

// Infrastructure repositories
import { WorkspaceRepository } from './infrastructure/db/repositories/workspace.repository.js';
import { ContentRepository } from './infrastructure/db/repositories/content.repository.js';
import { IdeaRepository } from './infrastructure/db/repositories/idea.repository.js';
import { PublicationRepository } from './infrastructure/db/repositories/publication.repository.js';
import { PlanRepository } from './infrastructure/db/repositories/plan.repository.js';
import { MetricRepository } from './infrastructure/db/repositories/metric.repository.js';
import { UserRepository } from './infrastructure/db/repositories/user.repository.js';

export interface Services {
  workspace: WorkspaceService;
  content: ContentService;
  idea: IdeaService;
  publication: PublicationService;
  plan: PlanService;
  metric: MetricService;
  user: UserService;
}

function createServices(): Services {
  const contentRepo = new ContentRepository();
  return {
    workspace: new WorkspaceService(new WorkspaceRepository()),
    content: new ContentService(contentRepo),
    idea: new IdeaService(new IdeaRepository(), contentRepo),
    publication: new PublicationService(new PublicationRepository()),
    plan: new PlanService(new PlanRepository()),
    metric: new MetricService(new MetricRepository()),
    user: new UserService(new UserRepository()),
  };
}

export async function buildApp() {
  const app = Fastify({ logger: config.NODE_ENV !== 'test' });

  await app.register(corsPlugin);
  await app.register(authPlugin);
  await app.register(rateLimit, { global: false });
  await app.register(multipart);
  await app.register(staticFiles, { root: UPLOADS_ROOT, prefix: '/uploads/' });

  const services = createServices();
  registerRoutes(app, services);

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof ZodError) {
      return reply.code(400).send({ error: error.errors[0]?.message ?? 'Validation error' });
    }
    if (error instanceof NotFoundError) return reply.code(404).send({ error: error.message });
    if (error instanceof ForbiddenError) return reply.code(403).send({ error: error.message });
    if (error instanceof ConflictError) return reply.code(409).send({ error: error.message });
    if (error instanceof ValidationError) return reply.code(400).send({ error: error.message });
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
