const API_URL = import.meta.env.VITE_GUMMYGUM_API_URL || (import.meta.env.DEV ? 'http://localhost:8000' : 'https://paige-server.onrender.com');
const STORAGE_KEY = 'gummygum_launch_session';

// Set while the host is ending the session so realtime listeners don't reroute mid-flow.
export const hostExitInProgressRef = { current: false };

export function getGummyGumSession() {
  if (typeof window === 'undefined') return null;
  const stored = sessionStorage.getItem(STORAGE_KEY) || localStorage.getItem(STORAGE_KEY);
  try {
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

async function verifyLaunchTokenOnce(ggt) {
  try {
    const res = await fetch(`${API_URL}/api/gummygum/launch/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: ggt }),
    });
    const body = await res.json();
    if (!res.ok || !body.success) {
      const fallbackUrl = body?.data?.fallbackUrl;
      // A rejected invite link goes to the hub's /join page, which explains the specific reason.
      if (typeof fallbackUrl === 'string' && fallbackUrl.startsWith('https://gummygum.app/')) {
        window.location.replace(fallbackUrl);
        return new Promise(() => {});
      }
      return null;
    }
    return body;
  } catch (err) {
    console.error('GummyGum launch verify failed', err);
    return null;
  }
}

export async function resolveGummyGumLaunch() {
  const params = new URLSearchParams(window.location.search);
  const ggt = params.get('ggt');

  if (!ggt) {
    return getGummyGumSession();
  }

  let body = await verifyLaunchTokenOnce(ggt);
  if (!body) {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    body = await verifyLaunchTokenOnce(ggt);
  }

  if (!body) {
    const existing = getGummyGumSession();
    if (existing) {
      params.delete('ggt');
      const query = params.toString();
      window.history.replaceState({}, '', window.location.pathname + (query ? `?${query}` : ''));
      return existing;
    }
    return null;
  }

  const hubUrl = body.data.hubUrl || (typeof document !== 'undefined' && document.referrer ? new URL(document.referrer).origin : 'https://gummygum.app');

  const session = {
    sessionId: body.data.sessionId,
    experienceId: body.data.experienceId,
    isGuest: body.data.isGuest,
    player: body.data.player,
    reportToken: body.data.reportToken,
    roomCode: body.data.roomCode || null,
    // The hub reuses a PIN across "run again" rounds; this tells rooms apart.
    hostedSessionId: params.get('sessionId') || null,
    isHost: Boolean(body.data.isHost),
    invitedCount: body.data.invitedCount || null,
    config: body.data.config || null,
    hubUrl,
    round: 1,
    reported: false,
  };
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));

  params.delete('ggt');
  const query = params.toString();
  window.history.replaceState({}, '', window.location.pathname + (query ? `?${query}` : ''));

  return session;
}

export async function reportGummyGumCancel() {
  const session = getGummyGumSession();
  if (!session || !session.reportToken) return;

  try {
    await fetch(`${API_URL}/api/gummygum/launch/cancel`, {
      method: 'POST',
      keepalive: true,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reportToken: session.reportToken }),
    });
  } catch (err) {
    console.error('GummyGum cancel report failed', err);
  } finally {
    sessionStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(STORAGE_KEY);
  }
}

export async function reportGummyGumResult(report) {
  const session = getGummyGumSession();
  if (!session || !session.reportToken) return;

  try {
    await fetch(`${API_URL}/api/gummygum/launch/report`, {
      method: 'POST',
      keepalive: true,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reportToken: session.reportToken, report }),
    });
    session.reported = true;
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch (err) {
    console.error('GummyGum result report failed', err);
  }
}

export async function closeGummyGumSession(finalReport) {
  const session = getGummyGumSession();
  if (!session) {
    window.location.href = 'https://gummygum.app';
    return;
  }

  if (!session.isHost) {
    console.warn('Only the session host can close the session.');
    returnToGummyGum();
    return;
  }

  try {
    await fetch(`${API_URL}/api/gummygum/launch/close`, {
      method: 'POST',
      keepalive: true,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reportToken: session.reportToken, report: finalReport }),
    });
  } catch (err) {
    console.error('GummyGum close session failed', err);
  } finally {
    const hub = session.hubUrl || 'https://gummygum.app';
    sessionStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(STORAGE_KEY);
    window.location.href = hub;
  }
}

// Host-only. A completed game is closed with its report; anything else is cancelled.
export async function endGummyGumSession({ completed = false, report = null } = {}) {
  const session = getGummyGumSession();
  if (session?.isHost && session.reportToken) {
    try {
      const res = await fetch(`${API_URL}/api/gummygum/launch/${completed ? 'close' : 'cancel'}`, {
        method: 'POST',
        keepalive: true,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          completed
            ? { reportToken: session.reportToken, report }
            : { reportToken: session.reportToken }
        ),
      });
      if (!res.ok) console.error('GummyGum end session failed', res.status);
    } catch (err) {
      console.error('GummyGum end session failed', err);
    }
  }
  returnToGummyGum();
}

export function returnToGummyGum() {
  const session = getGummyGumSession();
  const hub = session?.hubUrl || 'https://gummygum.app';
  sessionStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(STORAGE_KEY);
  window.location.href = hub;
}

const HUB_STATUS_POLL_MS = 15000;

// The hub can't write to this experience's realtime DB, so a hub-side end is only visible via the backend.
export function watchHubSessionStatus({ pin, hostedSessionId, onEnded }) {
  if (typeof window === 'undefined' || !pin || !hostedSessionId) return () => {};
  let stopped = false;
  let inFlight = false;
  let timer = null;

  const stop = () => {
    stopped = true;
    clearInterval(timer);
    document.removeEventListener('visibilitychange', onVisibility);
  };

  const check = async () => {
    if (stopped || inFlight || document.hidden) return;
    inFlight = true;
    try {
      const res = await fetch(`${API_URL}/api/gummygum/sessions/by-pin/${encodeURIComponent(pin)}`);
      if (!res.ok) return;
      const body = await res.json();
      const data = body?.data;
      if (stopped || !body?.success || !data?.id) return;
      const isOurs = String(data.id) === String(hostedSessionId);
      if (!isOurs || data.status === 'Ended') {
        stop();
        onEnded(data);
      }
    } catch {
      // Network errors never end the session.
    } finally {
      inFlight = false;
    }
  };

  function onVisibility() {
    if (!document.hidden) check();
  }

  document.addEventListener('visibilitychange', onVisibility);
  timer = setInterval(check, HUB_STATUS_POLL_MS);
  check();
  return stop;
}
