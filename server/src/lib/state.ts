export type FrontierId = string;

export type StatusEntry = {
  kind: 'check-in' | 'manual-action' | 'system';
  text: string;
  ts: number;
};

export type UserState = {
  userId: FrontierId;
  subscribedAt: number | null;
  entries: StatusEntry[];
  lastActionAt: number | null;
};

const store = new Map<FrontierId, UserState>();

function createEmptyState(userId: FrontierId): UserState {
  return {
    userId,
    subscribedAt: null,
    entries: [],
    lastActionAt: null,
  };
}

// V1 state is in-memory and resets on cold starts. Production operators should
// swap this for Vercel KV, Cloudflare KV, or Postgres before handling real users.
export const state = {
  async get(userId: FrontierId): Promise<UserState | null> {
    return store.get(userId) ?? null;
  },

  async put(userId: FrontierId, next: Omit<UserState, 'userId'>): Promise<UserState> {
    const value = { userId, ...next };
    store.set(userId, value);
    return value;
  },

  async append(userId: FrontierId, entry: StatusEntry): Promise<UserState> {
    const current = store.get(userId) ?? createEmptyState(userId);
    const next = {
      ...current,
      entries: [entry, ...current.entries].slice(0, 20),
      lastActionAt: entry.ts,
    };
    store.set(userId, next);
    return next;
  },

  async delete(userId: FrontierId): Promise<void> {
    store.delete(userId);
  },

  async reset(): Promise<void> {
    store.clear();
  },
};
