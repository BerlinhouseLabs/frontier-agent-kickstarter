export type FrontierUser = {
  id: string;
  firstName?: string;
  lastName?: string;
  email?: string;
};

export type FrontierUserProfile = {
  id: number;
  user: number;
  firstName: string;
  lastName: string;
  community: string;
  communityName: string;
  [key: string]: unknown;
};

export type PaginatedResponse<T> = {
  count: number;
  results: T[];
};

type ClientOptions = {
  apiKey: string;
  baseUrl: string;
  onBehalfOf?: string;
};

export class FrontierClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly actingUser?: string;

  constructor(opts: ClientOptions) {
    this.apiKey = opts.apiKey;
    this.baseUrl = opts.baseUrl.replace(/\/$/, '');
    this.actingUser = opts.onBehalfOf;
  }

  onBehalfOf(frontierId: string): FrontierClient {
    return new FrontierClient({
      apiKey: this.apiKey,
      baseUrl: this.baseUrl,
      onBehalfOf: frontierId,
    });
  }

  getUser(): UserAccess {
    return new UserAccess(this);
  }

  getEvents(): EventsAccess {
    return new EventsAccess(this);
  }

  async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const headers = new Headers(init.headers);
    headers.set('Accept', 'application/json');
    headers.set('X-API-Key', this.apiKey);

    // Platform-side recognition of X-OnBehalfOf is the key agent primitive.
    // See docs/MULTI_TENANCY.md for the Registry-backed validation contract.
    if (this.actingUser) {
      headers.set('X-OnBehalfOf', this.actingUser);
    }

    if (init.body && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }

    const response = await fetch(`${this.baseUrl}${path}`, { ...init, headers });
    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Frontier API ${response.status} ${response.statusText}: ${body}`);
    }

    return response.json() as Promise<T>;
  }
}

export class UserAccess {
  constructor(private readonly client: FrontierClient) {}

  async getDetails(): Promise<FrontierUser> {
    return this.client.request<FrontierUser>('/auth/users/me/');
  }

  async getProfile(): Promise<FrontierUserProfile> {
    return this.client.request<FrontierUserProfile>('/auth/profiles/me/');
  }
}

export type EventListParams = {
  startDate?: string;
  endDate?: string;
  page?: number;
};

export class EventsAccess {
  constructor(private readonly client: FrontierClient) {}

  async listEvents(params: EventListParams = {}): Promise<PaginatedResponse<unknown>> {
    const qp = new URLSearchParams();
    if (params.startDate) qp.set('start_date', params.startDate);
    if (params.endDate) qp.set('end_date', params.endDate);
    if (params.page) qp.set('page', String(params.page));

    const query = qp.toString();
    return this.client.request<PaginatedResponse<unknown>>(query ? `/events/?${query}` : '/events/');
  }
}

export function frontierClientFromEnv(): FrontierClient {
  return new FrontierClient({
    apiKey: process.env.FRONTIER_API_KEY ?? '',
    baseUrl: process.env.SANDBOX_API_BASE ?? 'https://api.sandbox.frontiertower.io',
  });
}
