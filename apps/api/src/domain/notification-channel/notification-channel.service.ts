export interface NotificationChannel {
  id: string;
  userId: string;
  type: string;
  enabled: boolean;
  config: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface INotificationChannelRepository {
  findByUserAndType(userId: string, type: string): Promise<NotificationChannel | null>;
  upsert(userId: string, type: string, data: { config?: Record<string, unknown>; enabled?: boolean }): Promise<NotificationChannel>;
  delete(userId: string, type: string): Promise<void>;
}

export class NotificationChannelService {
  constructor(private repo: INotificationChannelRepository) {}

  findByUserAndType(userId: string, type: string) {
    return this.repo.findByUserAndType(userId, type);
  }

  upsert(userId: string, type: string, data: { config?: Record<string, unknown>; enabled?: boolean }) {
    return this.repo.upsert(userId, type, data);
  }

  delete(userId: string, type: string) {
    return this.repo.delete(userId, type);
  }
}
