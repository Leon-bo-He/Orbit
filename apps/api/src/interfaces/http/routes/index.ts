import type { FastifyInstance } from 'fastify';
import type { Services } from '../../../app.js';
import { healthRoutes } from './health.js';
import { authRoutes } from './auth.js';
import { workspacesRoutes } from './workspaces.js';
import { contentsRoutes } from './contents.js';
import { ideasRoutes } from './ideas.js';
import { publicationsRoutes } from './publications.js';
import { contentPlansRoutes } from './content-plans.js';
import { metricsRoutes } from './metrics.js';
import { dashboardRoutes } from './dashboard.js';
import { exportRoutes } from './export.js';
import { importRoutes } from './import.js';
import { customPlatformsRoutes } from './custom-platforms.js';
import { uploadRoutes } from './upload.js';
import { notificationsRoutes } from './notifications.js';

export function registerRoutes(app: FastifyInstance, svc: Services) {
  healthRoutes(app);
  authRoutes(app, svc.user);
  workspacesRoutes(app, svc.workspace);
  contentsRoutes(app, svc.content, svc.workspace, svc.idea);
  ideasRoutes(app, svc.idea);
  publicationsRoutes(app, svc.publication, svc.content);
  contentPlansRoutes(app, svc.plan, svc.content, svc.workspace);
  metricsRoutes(app, svc.metric);
  dashboardRoutes(app, svc.metric, svc.workspace);
  exportRoutes(app);
  importRoutes(app);
  customPlatformsRoutes(app);
  uploadRoutes(app);
  notificationsRoutes(app, svc.user);
}
