import { FrontierSDK, type User } from '@frontiertower/frontier-sdk';
import { isInFrontierApp, renderStandaloneMessage } from '@frontiertower/frontier-sdk/ui-utils';
import './style.css';

const sdk = new FrontierSDK();
const SERVER_URL = 'http://localhost:8787';

type StatusEntry = {
  kind: 'check-in' | 'manual-action' | 'system';
  text: string;
  ts: number;
};

type AgentStatusSurface = {
  userId: string;
  subscribed: boolean;
  subscribedAt: number | null;
  budget: { currency: string; maxPerPeriod: string; periodDays: number; usedThisPeriod: string };
  scopes: string[];
  lastCheckIn: number | null;
  nextCheckIn: number | null;
  entries: StatusEntry[];
};

type ViewState = {
  status: AgentStatusSurface | null;
  loading: boolean;
  pinging: boolean;
  error: string;
  unsubscribeNote: string;
};

async function init() {
  const app = document.querySelector<HTMLDivElement>('#app')!;

  if (!isInFrontierApp()) {
    renderStandaloneMessage(app, 'Hello Agent');
    return;
  }

  try {
    app.innerHTML = '<div class="loading">Loading...</div>';

    const user = await sdk.getUser().getDetails();
    const frontierId = String(user.id);
    const view: ViewState = {
      status: null,
      loading: true,
      pinging: false,
      error: '',
      unsubscribeNote: '',
    };

    const fetchStatus = async () => {
      view.loading = true;
      view.error = '';
      renderAndAttach();

      try {
        const response = await fetch(`${SERVER_URL}/state/${encodeURIComponent(frontierId)}`);
        if (!response.ok) throw new Error(`Status request failed: ${response.status}`);
        view.status = await response.json();
      } catch (error) {
        view.error = error instanceof Error ? error.message : 'Unknown status error';
      } finally {
        view.loading = false;
        renderAndAttach();
      }
    };

    const renderAndAttach = () => {
      render(app, user, view);

      document.querySelector<HTMLButtonElement>('#refresh-btn')?.addEventListener('click', fetchStatus);
      document.querySelector<HTMLButtonElement>('#unsubscribe-btn')?.addEventListener('click', () => {
        view.unsubscribeNote = 'Unsubscribe is handled by the Frontier OS App Store subscription screen.';
        renderAndAttach();
      });

      document.querySelector<HTMLButtonElement>('#ping-btn')?.addEventListener('click', async () => {
        view.pinging = true;
        view.error = '';
        renderAndAttach();

        try {
          const response = await fetch(`${SERVER_URL}/action/ping`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ frontierId }),
          });
          if (!response.ok) throw new Error(`Ping failed: ${response.status}`);
          view.status = await response.json();
        } catch (error) {
          view.error = error instanceof Error ? error.message : 'Unknown ping error';
        } finally {
          view.pinging = false;
          renderAndAttach();
        }
      });
    };

    await fetchStatus();
    window.setInterval(fetchStatus, 30000);
  } catch (error) {
    app.innerHTML = `
      <div class="container">
        <h1>Error</h1>
        <div class="card">
          <p><strong>Failed to load:</strong> ${escapeHtml(error instanceof Error ? error.message : 'Unknown error')}</p>
        </div>
      </div>
    `;
  }
}

function render(container: HTMLElement, user: User, view: ViewState) {
  const userName = user.firstName || 'Citizen';
  const status = view.status;

  container.innerHTML = `
    <div class="container">
      <h1>Hello Agent</h1>

      <div class="card">
        <p style="text-align: center;"><strong>Hello, ${escapeHtml(userName)}.</strong></p>
      </div>

      <div class="card">
        <h2>Subscription</h2>
        <p><strong>Status:</strong> ${status?.subscribed ? 'Subscribed to Hello Agent' : 'Waiting for subscription'}</p>
        <p><strong>Budget:</strong> $${escapeHtml(status?.budget.maxPerPeriod ?? '0.00')}/month</p>
        <p><strong>Scopes:</strong> ${escapeHtml((status?.scopes ?? ['user:read']).join(', '))}</p>
        <button id="unsubscribe-btn">Unsubscribe</button>
        ${view.unsubscribeNote ? `<p class="note">${escapeHtml(view.unsubscribeNote)}</p>` : ''}
      </div>

      <div class="card">
        <h2>Live Status</h2>
        ${view.loading ? '<p>Refreshing agent status...</p>' : renderStatus(status)}
        <button id="refresh-btn">Refresh status</button>
      </div>

      <div class="card">
        <h2>Manual Run</h2>
        <p>Ask the operator server to run the same check-in handler it runs from cron:weekly.</p>
        <button id="ping-btn" ${view.pinging ? 'disabled' : ''}>${view.pinging ? 'Sending ping...' : 'Send manual ping'}</button>
        ${view.error ? `<p class="error">${escapeHtml(view.error)}</p>` : ''}
      </div>
    </div>
  `;
}

function renderStatus(status: AgentStatusSurface | null): string {
  if (!status) {
    return '<p>No operator status yet. Send a manual ping once the server is running.</p>';
  }

  const last = status.lastCheckIn ? formatRelativeTime(status.lastCheckIn) : 'Never';
  const next = status.nextCheckIn ? formatRelativeTime(status.nextCheckIn) : 'Waiting for cron';
  const entries = status.entries.length
    ? status.entries.map((entry) => `<li><strong>${formatRelativeTime(entry.ts)}:</strong> ${escapeHtml(entry.text)}</li>`).join('')
    : '<li>No check-ins recorded yet.</li>';

  return `
    <p><strong>Last check-in:</strong> ${last}</p>
    <p><strong>Next:</strong> ${next}</p>
    <ul class="entries">${entries}</ul>
  `;
}

function formatRelativeTime(ts: number): string {
  const diff = ts - Date.now();
  const abs = Math.abs(diff);
  const unit = abs < 3600000 ? 'minute' : abs < 86400000 ? 'hour' : 'day';
  const divisor = unit === 'minute' ? 60000 : unit === 'hour' ? 3600000 : 86400000;
  const value = Math.round(diff / divisor);
  return new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' }).format(value, unit);
}

function escapeHtml(value: string): string {
  return value
    .split('&').join('&amp;')
    .split('<').join('&lt;')
    .split('>').join('&gt;')
    .split('"').join('&quot;')
    .split("'").join('&#039;');
}

init();
