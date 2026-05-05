export interface PublishPayload {
  storageState: object;
  contentType: 'video' | 'note';
  title: string;
  description: string;
  tags: string[];
  videoPath?: string;
  imagePaths?: string[];
  thumbnailPath?: string;
  scheduledAt?: string;
  locale?: string;
  productLink?: string;
  productTitle?: string;
}

export interface PublishResult {
  success: boolean;
  postUrl?: string;
  postId?: string;
  failureReason?: string;
  logExcerpt: string;
  finalStorageState: object;
}

export interface ValidateResult {
  valid: boolean;
  reason?: string;
  finalStorageState?: object;
}

export interface ProgressEvent {
  step: string;
  percent?: number;
  message?: string;
}

export interface PublishAdapter {
  readonly platform: string;
  readonly supportsVideo: boolean;
  readonly supportsNote: boolean;
  readonly supportsScheduling: boolean;

  validateCookie(storageState: object): Promise<ValidateResult>;
  publishVideo(payload: PublishPayload, onProgress: (e: ProgressEvent) => void): Promise<PublishResult>;
  publishNote?(payload: PublishPayload, onProgress: (e: ProgressEvent) => void): Promise<PublishResult>;
}
