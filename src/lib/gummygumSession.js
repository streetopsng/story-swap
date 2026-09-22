const API_URL = import.meta.env.VITE_GUMMYGUM_API_URL || 'http://localhost:8000';
const STORAGE_KEY = 'gummygum_launch_session';

export function getGummyGumSession() {
  if (typeof window === 'undefined') return null;
  const stored = sessionStorage.getItem(STORAGE_KEY);
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
    if (!res.ok || !body.success) return null;
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
  if (!body) return null;

  const hubUrl = body.data.hubUrl || (typeof document !== 'undefined' && document.referrer ? new URL(document.referrer).origin : 'https://gummygum.app');

  const session = {
    sessionId: body.data.sessionId,
    experienceId: body.data.experienceId,
    isGuest: body.data.isGuest,
    player: body.data.player,
    reportToken: body.data.reportToken,
    roomCode: body.data.roomCode || null,
    isHost: Boolean(body.data.isHost),
    invitedCount: body.data.invitedCount || null,
    hubUrl,
    round: 1,
    reported: false,
  };
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));

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
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reportToken: session.reportToken }),
    });
  } catch (err) {
    console.error('GummyGum cancel report failed', err);
  } finally {
    sessionStorage.removeItem(STORAGE_KEY);
  }
}

export async function reportGummyGumResult(report) {
  const session = getGummyGumSession();
  if (!session || !session.reportToken) return;

  try {
    await fetch(`${API_URL}/api/gummygum/launch/report`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reportToken: session.reportToken, report }),
    });
    session.reported = true;
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
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
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reportToken: session.reportToken, report: finalReport }),
    });
  } catch (err) {
    console.error('GummyGum close session failed', err);
  } finally {
    const hub = session.hubUrl || 'https://gummygum.app';
    sessionStorage.removeItem(STORAGE_KEY);
    window.location.href = hub;
  }
}

export function returnToGummyGum() {
  const session = getGummyGumSession();
  const hub = session?.hubUrl || 'https://gummygum.app';
  sessionStorage.removeItem(STORAGE_KEY);
  window.location.href = hub;
}
