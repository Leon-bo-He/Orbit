import type { FastifyInstance } from 'fastify';
import { healthRoutes } from './health';
import { authRoutes } from './auth';
import { ideasRoutes } from './ideas';
import { workspacesRoutes } from './workspaces';
import { contentsRoutes } from './contents';
import { contentPlansRoutes } from './content-plans';
import { publicationsRoutes } from './publications';
import { metricsRoutes } from './metrics';
import { dashboardRoutes } from './dashboard';
import { exportRoutes } from './export';
import { importRoutes } from './import';

export async function registerRoutes(app: FastifyInstance) {
  await app.register(healthRoutes);
  await app.register(authRoutes);
  await app.register(ideasRoutes);
  await app.register(workspacesRoutes);
  await app.register(contentsRoutes);
  await app.register(contentPlansRoutes);
  await app.register(publicationsRoutes);
  await app.register(metricsRoutes);
  await app.register(dashboardRoutes);
  await app.register(exportRoutes);
  await app.register(importRoutes);
}
