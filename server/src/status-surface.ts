import { state, type FrontierId, type StatusEntry, type UserState } from './lib/state.js';

export type AgentStatusSurface = {
  userId: FrontierId;
  subscribed: boolean;
  subscribedAt: number | null;
  budget: {
    currency: 'FND';
    maxPerPeriod: string;
    periodDays: number;
    usedThisPeriod: string;
  };
  scopes: string[];
  lastCheckIn: number | null;
  nextCheckIn: number | null;
  entries: StatusEntry[];
};

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export async function getState(userId: FrontierId): Promise<UserState | null> {
  return state.get(userId);
}

export function formatForPwa(userId: FrontierId, userState: UserState | null): AgentStatusSurface {
  const lastCheckIn = userState?.entries.find((entry) => entry.kind === 'check-in')?.ts ?? null;

  return {
    userId,
    subscribed: Boolean(userState?.subscribedAt),
    subscribedAt: userState?.subscribedAt ?? null,
    budget: {
      currency: 'FND',
      maxPerPeriod: '0.00',
      periodDays: 30,
      usedThisPeriod: '0.00',
    },
    scopes: ['user:read'],
    lastCheckIn,
    nextCheckIn: lastCheckIn ? lastCheckIn + WEEK_MS : null,
    entries: userState?.entries ?? [],
  };
}
