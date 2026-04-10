import type { users } from '../../db/schema/users.js';

export type User = typeof users.$inferSelect;

export interface IUserRepository {
  findByEmail(email: string): Promise<User | null>;
  findById(id: string): Promise<User | null>;
  create(data: { email: string; name: string; passwordHash: string }): Promise<User>;
  update(id: string, data: Partial<{ name: string; email: string; locale: string; timezone: string }>): Promise<User | null>;
  updatePassword(id: string, passwordHash: string): Promise<void>;
  delete(id: string): Promise<void>;
}

export class UserService {
  constructor(private repo: IUserRepository) {}

  findByEmail(email: string) {
    return this.repo.findByEmail(email);
  }

  findById(id: string) {
    return this.repo.findById(id);
  }

  create(data: Parameters<IUserRepository['create']>[0]) {
    return this.repo.create(data);
  }

  update(id: string, data: Parameters<IUserRepository['update']>[1]) {
    return this.repo.update(id, data);
  }

  updatePassword(id: string, passwordHash: string) {
    return this.repo.updatePassword(id, passwordHash);
  }

  delete(id: string) {
    return this.repo.delete(id);
  }
}
