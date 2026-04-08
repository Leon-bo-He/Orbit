import type { Stage } from '../enums/stage.js';
import type { ContentType } from '../enums/content-type.js';
import type { Platform } from '../enums/platform.js';

export interface StageHistoryEntry {
  stage: Stage;
  timestamp: string; // ISO 8601
}

export interface ContentAttachment {
  type: 'image' | 'video' | 'link' | 'file';
  url: string;
  name: string;
}

export interface Content {
  id: string;
  workspaceId: string;
  ideaId: string | null;
  title: string;
  description: string | null;
  contentType: ContentType;
  stage: Stage;
  tags: string[];
  targetPlatforms: Platform[];
  scheduledAt: Date | null;
  publishedAt: Date | null;
  notes: string | null;
  reviewNotes: string | null;
  attachments: ContentAttachment[];
  stageHistory: StageHistoryEntry[];
  createdAt: Date;
  updatedAt: Date;
}

export type CreateContentInput = Pick<Content, 'workspaceId' | 'title' | 'contentType'> & {
  ideaId?: string;
  description?: string;
  tags?: string[];
  targetPlatforms?: Platform[];
  scheduledAt?: Date;
  notes?: string;
};

export type UpdateContentInput = Partial<
  Pick<
    Content,
    | 'title'
    | 'description'
    | 'contentType'
    | 'stage'
    | 'tags'
    | 'targetPlatforms'
    | 'scheduledAt'
    | 'notes'
    | 'reviewNotes'
    | 'attachments'
  >
>;
