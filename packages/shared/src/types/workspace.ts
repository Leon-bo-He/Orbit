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
  about: string | null;
  publishGoal: PublishGoal | null;
  timezone: string;
  stageConfig: KanbanStageConfig[];
  createdAt: Date;
}

export type CreateWorkspaceInput = Pick<
  Workspace,
  'name' | 'icon' | 'color' | 'timezone'
> & { about?: string; publishGoal?: PublishGoal };

// color intentionally excluded — immutable after creation
export type UpdateWorkspaceInput = Partial<
  Pick<Workspace, 'name' | 'icon' | 'about' | 'publishGoal' | 'timezone' | 'stageConfig'>
>;
