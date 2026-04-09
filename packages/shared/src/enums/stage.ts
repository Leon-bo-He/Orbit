export const Stage = {
  PLANNED: 'planned',
  PLANNING: 'planning',
  CREATING: 'creating',
  READY: 'ready',
  PUBLISHING: 'publishing',
  PUBLISHED: 'published',
  REVIEWED: 'reviewed',
  ARCHIVED: 'archived',
} as const;

export type Stage = (typeof Stage)[keyof typeof Stage];

export const STAGE_ORDER: Stage[] = [
  'planned', 'planning', 'creating', 'ready', 'publishing', 'published', 'reviewed', 'archived',
];
