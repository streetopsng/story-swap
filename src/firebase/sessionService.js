import { db, isFirebaseConfigured } from './config';
import {
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
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
    av: typeof item === 'object' && item.av ? item.av : '🙂',
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
  setLocalStore(`participants_${sessionId}`, initialParticipants);
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
export async function joinSession(sessionId, { email, name, avatar, dept = '' }) {
  const normalizedEmail = email.trim().toLowerCase();
  const participantId = normalizedEmail || `p_${Date.now()}`;

  const participantData = {
    id: participantId,
    email: normalizedEmail,
    name: name.trim(),
    av: avatar || '🙂',
    dept,
    status: 'joined',
    joinedAt: Date.now(),
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
export async function endSession(sessionId) {
  const updates = {
    status: 'ended',
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

