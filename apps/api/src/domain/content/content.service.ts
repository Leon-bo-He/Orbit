import type { contents } from '../../db/schema/contents.js';
import { ForbiddenError, NotFoundError, ValidationError } from '../errors.js';

export type Content = typeof contents.$inferSelect;
export type StageHistoryEntry = { stage: string; timestamp: string };

export interface IContentRepository {
  create(data: {
    workspaceId: string;
    ideaId?: string | null;
    title: string;
    contentType: string;
    description?: string | null;
    tags: string[];
    targetPlatforms: string[];
    scheduledAt?: Date | null;
    notes?: string | null;
    stageHistory: StageHistoryEntry[];
  }): Promise<Content>;

  findByWorkspace(workspaceId: string, filters: {
    stage?: string | string[];
  }): Promise<Content[]>;

  findCalendar(workspaceIds: string[], from: Date, to: Date): Promise<Content[]>;

  findAllByWorkspaces(wsIds: string[], filters: {
    from?: Date;
    to?: Date;
  }): Promise<Content[]>;

  findById(id: string): Promise<Content | null>;

  findByIdWithWorkspaceUser(id: string, userId: string): Promise<{ id: string; workspaceId: string } | null>;

  update(id: string, data: Partial<typeof contents.$inferInsert>): Promise<Content | null>;

  delete(id: string): Promise<void>;

  deleteArchived(wsIds: string[], filters: { from?: Date; to?: Date }): Promise<string[]>;

  stampPublishedAt(id: string, publishedAt: Date): Promise<void>;
}

export class ContentService {
  constructor(private repo: IContentRepository) {}

  async verifyOwnership(contentId: string, userId: string): Promise<{ id: string; workspaceId: string }> {
    const row = await this.repo.findByIdWithWorkspaceUser(contentId, userId);
    if (!row) throw new ForbiddenError();
    return row;
  }

  create(data: Omit<Parameters<IContentRepository['create']>[0], 'stageHistory'>) {
    return this.repo.create({
      ...data,
      stageHistory: [{ stage: 'planned', timestamp: new Date().toISOString() }],
    });
  }

  list(workspaceId: string, filters: { stage?: string }) {
    const stages = filters.stage
      ? filters.stage.split(',').map((s) => s.trim()).filter(Boolean)
      : undefined;
    const stageFilter = stages && stages.length === 1 ? stages[0] : stages;
    const repoFilters: { stage?: string | string[] } = {};
    if (stageFilter !== undefined) repoFilters.stage = stageFilter;
    return this.repo.findByWorkspace(workspaceId, repoFilters);
  }

  async getCalendar(
    userId: string,
    from: Date,
    to: Date,
    workspaceId?: string,
    getWorkspaceIds?: () => Promise<string[]>,
  ): Promise<Record<string, Content[]>> {
    let wsIds: string[];

    if (workspaceId) {
      wsIds = [workspaceId];
    } else if (getWorkspaceIds) {
      wsIds = await getWorkspaceIds();
      if (wsIds.length === 0) return {};
    } else {
      return {};
    }

    const rows = await this.repo.findCalendar(wsIds, from, to);
    const grouped: Record<string, Content[]> = {};
    for (const row of rows) {
      if (!row.scheduledAt) continue;
      const key = row.scheduledAt.toISOString().slice(0, 10);
      (grouped[key] ??= []).push(row);
    }
    return grouped;
  }

  getArchivedExport(wsIds: string[], filters: { from?: Date; to?: Date }) {
    return this.repo.findAllByWorkspaces(wsIds, filters);
  }

  deleteArchived(wsIds: string[], filters: { from?: Date; to?: Date }) {
    return this.repo.deleteArchived(wsIds, filters);
  }

  async delete(id: string, userId: string) {
    const existing = await this.repo.findById(id);
    if (!existing) throw new NotFoundError('Content not found');
    const ownership = await this.repo.findByIdWithWorkspaceUser(id, userId);
    if (!ownership) throw new ForbiddenError();
    await this.repo.delete(id);
  }

  async update(id: string, userId: string, body: {
    title?: string;
    description?: string | null;
    contentType?: string;
    stage?: string;
    stageHistory?: StageHistoryEntry[];
    tags?: string[];
    targetPlatforms?: string[];
    scheduledAt?: Date | null;
    notes?: string | null;
    reviewNotes?: string | null;
  }) {
    const ownership = await this.repo.findByIdWithWorkspaceUser(id, userId);
    if (!ownership) throw new ForbiddenError();

    const updateData: Partial<typeof contents.$inferInsert> = {};

    if (body.title !== undefined) updateData.title = body.title;
    if (body.description !== undefined) updateData.description = body.description ?? null;
    if (body.contentType !== undefined) updateData.contentType = body.contentType;
    if (body.tags !== undefined) updateData.tags = body.tags;
    if (body.targetPlatforms !== undefined) updateData.targetPlatforms = body.targetPlatforms;
    if (body.scheduledAt !== undefined) updateData.scheduledAt = body.scheduledAt ?? null;
    if (body.notes !== undefined) updateData.notes = body.notes ?? null;
    if (body.reviewNotes !== undefined) updateData.reviewNotes = body.reviewNotes ?? null;

    let previousStage: string | undefined;
    if (body.stage !== undefined) {
      const current = await this.repo.findById(id);
      previousStage = current?.stage;
      const history = ((current?.stageHistory ?? []) as StageHistoryEntry[]);
      history.push({ stage: body.stage, timestamp: new Date().toISOString() });
      updateData.stage = body.stage;
      updateData.stageHistory = history;
      updateData.updatedAt = new Date();
    }

    if (body.stageHistory !== undefined) {
      const entries = body.stageHistory;
      const sorted = [...entries].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      for (let i = 1; i < sorted.length; i++) {
        if (new Date(sorted[i]!.timestamp).getTime() <= new Date(sorted[i - 1]!.timestamp).getTime()) {
          throw new ValidationError('Timeline entries must be in chronological order');
        }
      }
      updateData.stageHistory = entries;
    }

    const updated = await this.repo.update(id, updateData);
    if (!updated) throw new NotFoundError('Content not found');

    return { updated, previousStage };
  }

  stampPublishedAt(id: string, publishedAt: Date) {
    return this.repo.stampPublishedAt(id, publishedAt);
  }
}
