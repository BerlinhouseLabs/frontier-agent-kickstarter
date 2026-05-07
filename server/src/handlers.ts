import { frontierClientFromEnv, type FrontierUser } from './lib/frontier-client.js';
import { state, type FrontierId, type UserState } from './lib/state.js';

type HandlerContext = {
  user: FrontierUser;
};

type UserActionContext = HandlerContext & {
  action: string;
};

const client = frontierClientFromEnv();

export const handlers = {
  async onSubscribe({ user }: HandlerContext): Promise<UserState> {
    return state.put(user.id, {
      subscribedAt: Date.now(),
      entries: [],
      lastActionAt: null,
    });
  },

  async onUnsubscribe({ user }: HandlerContext): Promise<void> {
    await state.delete(user.id);
  },

  async onTick({ user }: HandlerContext): Promise<UserState> {
    const profile = await client.onBehalfOf(user.id).getUser().getProfile();
    const firstName = profile.firstName || user.firstName || 'Citizen';
    const community = profile.communityName ? ` on ${profile.communityName}` : '';

    return state.append(user.id, {
      kind: 'check-in',
      text: `Checked in with ${firstName}${community}`,
      ts: Date.now(),
    });
  },

  async onUserAction({ user, action }: UserActionContext): Promise<UserState> {
    if (action !== 'ping') {
      throw new Error(`Unknown action: ${action}`);
    }

    await state.append(user.id, {
      kind: 'manual-action',
      text: 'Manual ping requested from the PWA',
      ts: Date.now(),
    });

    try {
      return await handlers.onTick({ user });
    } catch (error) {
      return state.append(user.id, {
        kind: 'system',
        text: `Profile check deferred: ${error instanceof Error ? error.message : 'unknown Frontier API error'}`,
        ts: Date.now(),
      });
    }
  },
};

export function userFromFrontierId(frontierId: FrontierId): FrontierUser {
  return { id: frontierId };
}
