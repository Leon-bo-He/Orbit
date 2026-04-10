import type { ideas } from '../../db/schema/ideas.js';
import type { contents } from '../../db/schema/contents.js';
import { NotFoundError } from '../errors.js';

export type Idea = typeof ideas.$inferSelect;
export type Content = typeof contents.$inferSelect;

export interface IIdeaRepository {
  create(data: {
    userId: string;
    workspaceId?: string | null;
    title: string;
    note?: string | null;
    tags: string[];
    priority: string;
    attachments: unknown[];
  }): Promise<Idea>;

  findAll(userId: string, filters: {
    workspaceId?: string | null | 'global';
    status?: string;
    priority?: string;
    q?: string;
  }): Promise<Idea[]>;

  findArchived(userId: string, filters: {
    workspaceId?: string | null | 'global';
    from?: Date;
    to?: Date;
  }): Promise<Idea[]>;

  deleteArchived(userId: string, filters: {
    workspaceId?: string | null | 'global';
    from?: Date;
    to?: Date;
  }): Promise<number>;

  findByIdAndUser(id: string, userId: string): Promise<Idea | null>;

  update(id: string, userId: string, data: Partial<{
    title: string;
    note: string | null;
    tags: string[];
    priority: string;
    attachments: unknown[];
    status: string;
    workspaceId: string | null;
    convertedTo: string | null;
  }>): Promise<Idea | null>;

  syncStatusByContentId(contentId: string, userId: string, status: string): Promise<void>;
}

export interface IContentCreatorRepository {
  createFromIdea(data: {
    workspaceId: string;
    ideaId: string;
    title: string;
    contentType: string;
    tags: string[];
    stageHistory: { stage: string; timestamp: string }[];
  }): Promise<Content>;
}

export class IdeaService {
  constructor(
    private repo: IIdeaRepository,
    private contentRepo: IContentCreatorRepository,
  ) {}

  create(userId: string, data: Omit<Parameters<IIdeaRepository['create']>[0], 'userId'>) {
    return this.repo.create({ ...data, userId });
  }

  list(userId: string, filters: Parameters<IIdeaRepository['findAll']>[1]) {
    return this.repo.findAll(userId, filters);
  }

  exportArchived(userId: string, filters: Parameters<IIdeaRepository['findArchived']>[1]) {
    return this.repo.findArchived(userId, filters);
  }

  deleteArchived(userId: string, filters: Parameters<IIdeaRepository['deleteArchived']>[1]) {
    return this.repo.deleteArchived(userId, filters);
  }

  async update(userId: string, id: string, data: Parameters<IIdeaRepository['update']>[2]) {
    const updated = await this.repo.update(id, userId, data);
    if (!updated) throw new NotFoundError('Idea not found');
    return updated;
  }

  async convert(userId: string, ideaId: string, workspaceId: string, title?: string, contentType?: string) {
    const idea = await this.repo.findByIdAndUser(ideaId, userId);
    if (!idea) throw new NotFoundError('Idea not found');

    const content = await this.contentRepo.createFromIdea({
      workspaceId,
      ideaId,
      title: title ?? idea.title,
      contentType: contentType ?? 'article',
      tags: (idea.tags as string[]) ?? [],
      stageHistory: [
        { stage: 'idea', timestamp: idea.createdAt.toISOString() },
        { stage: 'planned', timestamp: new Date().toISOString() },
      ],
    });

    const updatedIdea = await this.repo.update(ideaId, userId, {
      status: 'converted',
      convertedTo: content.id,
    });

    return { idea: updatedIdea!, content };
  }

  syncStatusByContentId(contentId: string, userId: string, status: string) {
    return this.repo.syncStatusByContentId(contentId, userId, status);
  }
}
