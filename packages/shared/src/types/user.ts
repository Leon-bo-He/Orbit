export interface User {
  id: string;
  email: string;
  username: string;
  avatar: string | null;
  locale: string;
  timezone: string;
  createdAt: Date;
}
