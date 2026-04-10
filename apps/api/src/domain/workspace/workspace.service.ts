import type { workspaces } from '../../db/schema/workspaces.js';
import { ForbiddenError, NotFoundError } from '../errors.js';

export type Workspace = typeof workspaces.$inferSelect;

export interface IWorkspaceRepository {
  create(userId: string, data: {
    name: string;
    icon: string;
    color: string;
    about?: string | null;
    publishGoal?: unknown;
  }): Promise<Workspace>;
  findAllByUser(userId: string): Promise<Workspace[]>;
  findByIdAndUser(id: string, userId: string): Promise<Workspace | null>;
  update(id: string, userId: string, data: Partial<{
    name: string;
    icon: string;
    about: string | null;
    publishGoal: unknown;
    stageConfig: unknown[];
  }>): Promise<Workspace | null>;
}

export class WorkspaceService {
  constructor(private repo: IWorkspaceRepository) {}

  create(userId: string, data: Parameters<IWorkspaceRepository['create']>[1]) {
    return this.repo.create(userId, data);
  }

  list(userId: string) {
    return this.repo.findAllByUser(userId);
  }

  async verifyOwnership(id: string, userId: string): Promise<Workspace> {
    const ws = await this.repo.findByIdAndUser(id, userId);
    if (!ws) throw new ForbiddenError();
    return ws;
  }

  async update(userId: string, id: string, data: Parameters<IWorkspaceRepository['update']>[2]) {
    const updated = await this.repo.update(id, userId, data);
    if (!updated) throw new NotFoundError('Workspace not found');
    return updated;
  }
}
