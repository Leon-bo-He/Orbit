import type { ContentType } from '../enums/content-type.js';

export interface PublishGoal {
  count: number;
  period: 'day' | 'week' | 'month';
}

export interface KanbanStageConfig {
  id: string;
  label: string;
  order: number;
}

export interface Workspace {
  id: string;
  userId: string;
  name: string;
  icon: string;
  color: string;
  contentType: ContentType;
  defaultLocale: string;
  publishGoal: PublishGoal | null;
  timezone: string;
  stageConfig: KanbanStageConfig[];
  createdAt: Date;
}

export type CreateWorkspaceInput = Pick<
  Workspace,
  'name' | 'icon' | 'color' | 'contentType' | 'defaultLocale' | 'timezone'
> & { publishGoal?: PublishGoal };

// color intentionally excluded — immutable after creation
export type UpdateWorkspaceInput = Partial<
  Pick<Workspace, 'name' | 'icon' | 'publishGoal' | 'defaultLocale' | 'timezone' | 'stageConfig'>
>;
