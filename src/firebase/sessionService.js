import { db, isFirebaseConfigured } from './config';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  serverTimestamp,
} from 'firebase/firestore';
import { buildSessionPrompts } from '../utils/questionBank';
import { buildGroups } from '../utils/grouping';

// ----------------------------------------------------
// Local Real-time BroadcastChannel Fallback (Offline/Dev)
// ----------------------------------------------------
const localSyncChannel = typeof window !== 'undefined' && 'BroadcastChannel' in window
  ? new BroadcastChannel('story_swap_sync')
  : null;

function getLocalStore(key, defaultValue = null) {
  try {
    const val = localStorage.getItem(`story_swap_${key}`);
    return val ? JSON.parse(val) : defaultValue;
  } catch {
    return defaultValue;
  }
}

function setLocalStore(key, value) {
  try {
    localStorage.setItem(`story_swap_${key}`, JSON.stringify(value));
    if (localSyncChannel) {
      localSyncChannel.postMessage({ type: 'SYNC_UPDATE', key, value });
    }
  } catch (err) {
    console.error('Error saving to localStore:', err);
  }
}

// ----------------------------------------------------
// Session Service API
// ----------------------------------------------------

/**
 * Generate a short 6-character alphanumeric session code
 */
export function generateSessionId() {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let id = '';
  for (let i = 0; i < 6; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return id;
}

/**
 * Get existing session details once
 */
export async function getSession(sessionId) {
  if (isFirebaseConfigured && db) {
    try {
      const sessionRef = doc(db, 'sessions', sessionId);
      const snap = await getDoc(sessionRef);
      if (snap.exists()) {
        return { id: snap.id, ...snap.data() };
      }
      return null;
    } catch {
      return null;
    }
  }
  return getLocalStore(`session_${sessionId}`, null);
}

export const CLOSED_STATUSES = ['ended', 'cancelled', 'expired'];

async function isSessionClosed(sessionId) {
  const current = await getSession(sessionId);
  return Boolean(current && CLOSED_STATUSES.includes(current.status));
}

export async function getParticipants(sessionId) {
  if (isFirebaseConfigured && db) {
    try {
      const snap = await getDocs(collection(db, 'sessions', sessionId, 'participants'));
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    } catch {
      return [];
    }
  }
  return getLocalStore(`participants_${sessionId}`, []);
}

/**
 * Create a new game session
 */
export async function createSession({
  sessionId: customSessionId,
  name = 'Team Bonding',
  roundCount = 3,
  invitedEmails = [],
  invitedCount = null,
  customQuestions = {},
  hostedSessionId = null,
} = {}) {
  const sessionId = customSessionId || generateSessionId();
  const prompts = buildSessionPrompts(roundCount, customQuestions);

  const sessionData = {
    id: sessionId,
    name: name.trim() || 'Team Bonding',
    roundCount: Number(roundCount),
    prompts,
    customQuestions,
    invitedCount: invitedCount ? Number(invitedCount) : (invitedEmails.length || null),
    hostedSessionId,
    status: 'lobby', // 'lobby' | 'in-progress' | 'completed'
    currentRound: 0,
    groups: [],
    roundStartedAt: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  const initialParticipants = invitedEmails.map(item => ({
    id: typeof item === 'string' ? item.toLowerCase() : item.email.toLowerCase(),
    email: typeof item === 'string' ? item.toLowerCase() : item.email.toLowerCase(),
    name: typeof item === 'object' && item.name ? item.name : '',
    dept: typeof item === 'object' && item.dept ? item.dept : '',
    av: typeof item === 'object' && item.av ? item.av : null,
    status: 'invited',
    joinedAt: null,
  }));

  if (isFirebaseConfigured && db) {
    try {
      const sessionRef = doc(db, 'sessions', sessionId);
      await setDoc(sessionRef, {
        ...sessionData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // A reused PIN keeps the earlier room's participants subcollection; drop anyone not joined to this room.
      if (hostedSessionId) {
        try {
          const existingParts = await getDocs(collection(db, 'sessions', sessionId, 'participants'));
          await Promise.all(
            existingParts.docs
              .filter((d) => d.data().hostedSessionId !== hostedSessionId)
              .map((d) => deleteDoc(d.ref))
          );
        } catch (error) {
          console.error('Firestore stale participant cleanup error:', error);
        }
      }

      // Write initial participants if any were invited
      for (const p of initialParticipants) {
        const pRef = doc(db, 'sessions', sessionId, 'participants', p.id);
        await setDoc(pRef, p);
      }

      return sessionId;
    } catch (error) {
      console.error('Firestore createSession error, falling back to local sync:', error);
    }
  }

  // Local fallback
  setLocalStore(`session_${sessionId}`, sessionData);
  const keptParticipants = hostedSessionId
    ? getLocalStore(`participants_${sessionId}`, []).filter((p) => p.hostedSessionId === hostedSessionId)
    : [];
  setLocalStore(`participants_${sessionId}`, [...keptParticipants, ...initialParticipants]);
  return sessionId;
}

/**
 * Subscribe to real-time session changes
 */
export function subscribeSession(sessionId, callback) {
  if (isFirebaseConfigured && db) {
    try {
      const sessionRef = doc(db, 'sessions', sessionId);
      const unsubscribe = onSnapshot(sessionRef, snapshot => {
        if (snapshot.exists()) {
          callback({ id: snapshot.id, ...snapshot.data() });
        } else {
          callback(null);
        }
      });
      return unsubscribe;
    } catch (error) {
      console.error('Firestore subscribeSession error, falling back to local sync:', error);
    }
  }

  // Local fallback
  const fetchCurrent = () => {
    const data = getLocalStore(`session_${sessionId}`, null);
    callback(data);
  };
  fetchCurrent();

  const handleMessage = (e) => {
    if (e.data && e.data.key === `session_${sessionId}`) {
      callback(e.data.value);
    }
  };

  if (localSyncChannel) {
    localSyncChannel.addEventListener('message', handleMessage);
  }

  // Also listen for storage events from other windows
  const handleStorage = (e) => {
    if (e.key === `story_swap_session_${sessionId}`) {
      fetchCurrent();
    }
  };
  window.addEventListener('storage', handleStorage);

  return () => {
    if (localSyncChannel) {
      localSyncChannel.removeEventListener('message', handleMessage);
    }
    window.removeEventListener('storage', handleStorage);
  };
}

/**
 * Subscribe to real-time participants in a session
 */
export function subscribeParticipants(sessionId, callback) {
  if (isFirebaseConfigured && db) {
    try {
      const partCol = collection(db, 'sessions', sessionId, 'participants');
      const unsubscribe = onSnapshot(partCol, snapshot => {
        const list = [];
        snapshot.forEach(docSnap => {
          list.push({ id: docSnap.id, ...docSnap.data() });
        });
        callback(list);
      });
      return unsubscribe;
    } catch (error) {
      console.error('Firestore subscribeParticipants error, falling back to local sync:', error);
    }
  }

  // Local fallback
  const fetchCurrent = () => {
    const list = getLocalStore(`participants_${sessionId}`, []);
    callback(list);
  };
  fetchCurrent();

  const handleMessage = (e) => {
    if (e.data && e.data.key === `participants_${sessionId}`) {
      callback(e.data.value || []);
    }
  };

  if (localSyncChannel) {
    localSyncChannel.addEventListener('message', handleMessage);
  }

  const handleStorage = (e) => {
    if (e.key === `story_swap_participants_${sessionId}`) {
      fetchCurrent();
    }
  };
  window.addEventListener('storage', handleStorage);

  return () => {
    if (localSyncChannel) {
      localSyncChannel.removeEventListener('message', handleMessage);
    }
    window.removeEventListener('storage', handleStorage);
  };
}

/**
 * Join or update player identity in session
 */
export async function joinSession(sessionId, { email, name, avatar, dept = '', hostedSessionId = null, byEmail = false }) {
  if (await isSessionClosed(sessionId)) return null;
  const normalizedEmail = (email || '').trim().toLowerCase();
  const participantId = normalizedEmail || `p_${Date.now()}`;

  let finalName = name.trim();
  let mine = null;
  // The invite email is the identity: the same email reclaims its record; a different email with the same name gets a suffix.
  if (byEmail && normalizedEmail) {
    const others = (await getParticipants(sessionId)).filter(
      (p) => !hostedSessionId || !p.hostedSessionId || p.hostedSessionId === hostedSessionId
    );
    mine = others.find((p) => p.id === participantId || (p.email || '').toLowerCase() === normalizedEmail) || null;
    const base = name.trim().toLowerCase();
    const prior = (mine?.name || '').trim().toLowerCase();
    const isOwnVariant = prior === base || (prior.startsWith(`${base} `) && /^\d+$/.test(prior.slice(base.length + 1)));
    if (mine?.name && mine.status === 'joined' && isOwnVariant) {
      finalName = mine.name;
    } else {
      const taken = (n) => others.some(
        (p) => p.id !== participantId && p.status === 'joined' && (p.name || '').trim().toLowerCase() === n.toLowerCase()
      );
      let n = 2;
      while (taken(finalName)) finalName = `${name.trim()} ${n++}`;
    }
  }

  const participantData = {
    id: participantId,
    email: normalizedEmail,
    name: finalName,
    av: avatar || mine?.av || null,
    dept,
    status: 'joined',
    joinedAt: (mine?.status === 'joined' && mine.joinedAt) || Date.now(),
    hostedSessionId,
  };

  if (isFirebaseConfigured && db) {
    try {
      const pRef = doc(db, 'sessions', sessionId, 'participants', participantId);
      await setDoc(pRef, participantData, { merge: true });
      return participantData;
    } catch (error) {
      console.error('Firestore joinSession error:', error);
    }
  }

  // Local fallback
  const currentList = getLocalStore(`participants_${sessionId}`, []);
  const existingIndex = currentList.findIndex(
    p => (p.email && p.email.toLowerCase() === normalizedEmail) || p.id === participantId
  );

  let updatedList;
  if (existingIndex >= 0) {
    updatedList = [...currentList];
    updatedList[existingIndex] = { ...updatedList[existingIndex], ...participantData };
  } else {
    updatedList = [...currentList, participantData];
  }

  setLocalStore(`participants_${sessionId}`, updatedList);
  return participantData;
}

/**
 * Host starts the game from the lobby
 */
export async function startSession(sessionId, participants) {
  const joinedOnly = participants.filter(p => p.status === 'joined');
  const activeParticipants = joinedOnly.length > 0 ? joinedOnly : participants;
  const groups = buildGroups(activeParticipants);

  const updates = {
    status: 'in-progress',
    currentRound: 0,
    groups,
    roundStartedAt: Date.now(),
    updatedAt: Date.now(),
  };

  if (isFirebaseConfigured && db) {
    try {
      const sessionRef = doc(db, 'sessions', sessionId);
      await updateDoc(sessionRef, updates);
      return;
    } catch (error) {
      console.error('Firestore startSession error:', error);
    }
  }

  // Local fallback
  const session = getLocalStore(`session_${sessionId}`);
  if (session) {
    setLocalStore(`session_${sessionId}`, { ...session, ...updates });
  }
}

/**
 * Host advances to the next round or finishes the session
 */
export async function advanceRound(sessionId, participants, currentRound, totalRounds, prevGroups) {
  const nextRoundIndex = currentRound + 1;
  const joinedOnly = participants.filter(p => p.status === 'joined');
  const activeParticipants = joinedOnly.length > 0 ? joinedOnly : participants;

  if (nextRoundIndex >= totalRounds) {
    // Finished!
    const updates = {
      status: 'completed',
      updatedAt: Date.now(),
    };
    if (isFirebaseConfigured && db) {
      await updateDoc(doc(db, 'sessions', sessionId), updates);
    } else {
      const session = getLocalStore(`session_${sessionId}`);
      if (session) setLocalStore(`session_${sessionId}`, { ...session, ...updates });
    }
    return;
  }

  // Next round
  const groups = buildGroups(activeParticipants, prevGroups);
  const updates = {
    currentRound: nextRoundIndex,
    groups,
    roundStartedAt: Date.now(),
    updatedAt: Date.now(),
  };

  if (isFirebaseConfigured && db) {
    try {
      const sessionRef = doc(db, 'sessions', sessionId);
      await updateDoc(sessionRef, updates);
      return;
    } catch (error) {
      console.error('Firestore advanceRound error:', error);
    }
  }

  // Local fallback
  const session = getLocalStore(`session_${sessionId}`);
  if (session) {
    setLocalStore(`session_${sessionId}`, { ...session, ...updates });
  }
}

/**
 * End session and mark cancelled/ended
 */
export async function endSession(sessionId, { completed = false } = {}) {
  const updates = {
    status: 'ended',
    completed,
    endedAt: Date.now(),
    updatedAt: Date.now(),
  };

  if (isFirebaseConfigured && db) {
    try {
      const sessionRef = doc(db, 'sessions', sessionId);
      await updateDoc(sessionRef, updates);
      return;
    } catch (error) {
      console.error('Firestore endSession error:', error);
    }
  }

  const session = getLocalStore(`session_${sessionId}`);
  if (session) {
    setLocalStore(`session_${sessionId}`, { ...session, ...updates });
  }
}


async function patchSession(sessionId, updates) {
  if (isFirebaseConfigured && db) {
    try {
      await updateDoc(doc(db, 'sessions', sessionId), updates);
      return;
    } catch (error) {
      console.error('Firestore patchSession error:', error);
    }
  }

  const session = getLocalStore(`session_${sessionId}`);
  if (session) {
    setLocalStore(`session_${sessionId}`, { ...session, ...updates });
  }
}

/**
 * Heartbeat from any connected client, used to tell an abandoned in-progress
 * session apart from a long-running live one.
 */
export function touchSessionActivity(sessionId) {
  return patchSession(sessionId, { lastActivity: Date.now() });
}

// A host relaunching its own lobby from the hub restarts the idle clock.
export function reopenLobby(sessionId) {
  return patchSession(sessionId, { lobbyOpenedAt: Date.now() });
}

export function markSessionAbandoned(sessionId) {
  return patchSession(sessionId, { status: 'expired', abandoned: true, updatedAt: Date.now() });
}

/**
 * Persist a group's current speaker so the turn clock survives refreshes and
 * stays shared across the group's devices.
 */
export async function setGroupTurn(sessionId, groupIndex, round, index) {
  if (await isSessionClosed(sessionId)) return;
  const entry = { round, index, startedAt: Date.now() };
  if (isFirebaseConfigured && db) {
    try {
      await updateDoc(doc(db, 'sessions', sessionId), { [`turnState.${groupIndex}`]: entry });
      return;
    } catch (error) {
      console.error('Firestore setGroupTurn error:', error);
    }
  }

  const session = getLocalStore(`session_${sessionId}`);
  if (session) {
    setLocalStore(`session_${sessionId}`, {
      ...session,
      turnState: { ...(session.turnState || {}), [groupIndex]: entry },
    });
  }
}
