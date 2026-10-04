export type AccountSettings = {
  name: string; email: string; emailVerified: boolean; timezone: string | null;
  sessionsAvailable: boolean;
  sessions: { id: string; current: boolean; createdAt: string; updatedAt: string; expiresAt: string; device: string }[];
};
