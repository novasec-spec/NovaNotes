// ─────────────────────────────────────────────────────────────────────────────
//  chatCache.tsx — AsyncStorage-backed message cache + offline outbox queue,
//  plus a dependency-free network-status probe.
//
//  Design notes:
//   - We keep the last CACHE_LIMIT *confirmed* messages per chat so the chat
//     screen has something to show immediately if a fresh load fails (no
//     network, slow network, etc). Optimistic/queued/sending messages are
//     never cached here — they live in the outbox instead.
//   - The outbox holds messages the user tried to send while offline (or
//     that failed to send) so they survive app restarts and can be retried
//     automatically the moment the connection comes back.
//   - Network detection: rather than depend on @react-native-community/netinfo
//     (which may or may not be installed in this project), we use a small
//     periodic Supabase probe. It's dependency-free and good enough to drive
//     an "offline" banner + outbox flush. If NetInfo is already part of this
//     app, swap the body of subscribeNetwork() for a NetInfo listener —
//     the call signature below won't need to change.
// ─────────────────────────────────────────────────────────────────────────────
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../../../config/supabase';
import { ChatMessage } from './chatShared';

export const CACHE_LIMIT = 15;
const PROBE_INTERVAL_MS = 8000;

const cacheKey = (chatId: string) => `chat_cache_${chatId}`;
const outboxKey = (chatId: string) => `chat_outbox_${chatId}`;

// ── Message cache ──────────────────────────────────────────────────────────
// Strip fields that only make sense within a single app session (local
// blob/file URIs) before persisting, so a restored cache never shows a
// broken image/video thumbnail.
function toCacheable(msg: ChatMessage): ChatMessage {
  const { _localImageUri, _localAudioUri, _localVideoUri, _optimisticId, _sendStatus, ...rest } = msg as any;
  return rest;
}

export async function cacheMessages(chatId: string, msgs: ChatMessage[]): Promise<void> {
  try {
    const confirmed = msgs.filter(m => !m._optimisticId && m._sendStatus !== 'sending' && m._sendStatus !== 'queued');
    const last = confirmed.slice(-CACHE_LIMIT).map(toCacheable);
    await AsyncStorage.setItem(cacheKey(chatId), JSON.stringify(last));
  } catch (e) {
    console.error('[ChatCache] cacheMessages:', e);
  }
}

export async function loadCachedMessages(chatId: string): Promise<ChatMessage[]> {
  try {
    const raw = await AsyncStorage.getItem(cacheKey(chatId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.error('[ChatCache] loadCachedMessages:', e);
    return [];
  }
}

// ── Outbox (pending sends) ──────────────────────────────────────────────────
export interface OutboxItem {
  localId: string; // matches the optimistic message's id / _optimisticId
  text: string;
  media?: { type: 'image' | 'audio' | 'video' | 'file'; uri: string; name?: string; dur?: number };
  replyToId?: string;
  createdAt: string;
  attempts: number;
}

export async function getOutbox(chatId: string): Promise<OutboxItem[]> {
  try {
    const raw = await AsyncStorage.getItem(outboxKey(chatId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.error('[ChatCache] getOutbox:', e);
    return [];
  }
}

async function saveOutbox(chatId: string, items: OutboxItem[]): Promise<void> {
  try {
    await AsyncStorage.setItem(outboxKey(chatId), JSON.stringify(items));
  } catch (e) {
    console.error('[ChatCache] saveOutbox:', e);
  }
}

export async function addToOutbox(chatId: string, item: OutboxItem): Promise<void> {
  const items = await getOutbox(chatId);
  // Avoid duplicate entries if the same message is queued twice (e.g. a
  // manual retry racing with an auto-flush).
  const next = items.filter(i => i.localId !== item.localId);
  next.push(item);
  await saveOutbox(chatId, next);
}

export async function removeFromOutbox(chatId: string, localId: string): Promise<void> {
  const items = await getOutbox(chatId);
  await saveOutbox(chatId, items.filter(i => i.localId !== localId));
}

export async function bumpOutboxAttempt(chatId: string, localId: string): Promise<void> {
  const items = await getOutbox(chatId);
  const next = items.map(i => i.localId === localId ? { ...i, attempts: i.attempts + 1 } : i);
  await saveOutbox(chatId, next);
}

// ── Network status (dependency-free, shared singleton) ──────────────────────
// Multiple chat screens could theoretically be mounted at once (e.g. a
// list/detail split view, or a screen kept alive in a navigator stack).
// Rather than have each one poll Supabase independently, all subscribers
// share a single interval — it starts on the first subscriber and stops
// once the last one unsubscribes.
type NetListener = (isOnline: boolean) => void;

const netListeners = new Set<NetListener>();
let currentlyOnline = true;
let hasProbed = false;
let probeIntervalId: ReturnType<typeof setInterval> | null = null;

function setOnlineState(online: boolean) {
  hasProbed = true;
  if (online === currentlyOnline) return;
  currentlyOnline = online;
  netListeners.forEach(l => l(online));
}

async function runProbe() {
  try {
    const { error } = await supabase.from('users').select('id').limit(1);
    setOnlineState(!error);
  } catch {
    setOnlineState(false);
  }
}

export function subscribeNetwork(onChange: NetListener): () => void {
  netListeners.add(onChange);

  // Give a newly-mounted screen the current known state immediately,
  // rather than leaving it assuming "online" until the next probe tick.
  if (hasProbed) onChange(currentlyOnline);

  if (!probeIntervalId) {
    runProbe();
    probeIntervalId = setInterval(runProbe, PROBE_INTERVAL_MS);
  }

  return () => {
    netListeners.delete(onChange);
    if (netListeners.size === 0 && probeIntervalId) {
      clearInterval(probeIntervalId);
      probeIntervalId = null;
    }
  };
}
