// src/utils/cache/screenCache.ts
//
// Small, generic cache layer over AsyncStorage for "stale-while-revalidate"
// screen data: show whatever was cached last time instantly on mount, then
// refresh from the network in the background and update both the UI and
// the cache. Used by NotificationScreen and CallHistoryScreen so neither
// has to show a blank/spinner screen on every visit just to redisplay data
// that hasn't changed.
//
// Not a general-purpose HTTP cache and not meant for huge datasets — this
// is for "the last screenful of list data", capped and versioned so a
// shape change on your end (e.g. a new field on AppNotification) can't
// come back to bite you as corrupted/half-migrated cached JSON.

import AsyncStorage from '@react-native-async-storage/async-storage';

/** Bump this if the shape of cached data ever changes incompatibly —
 *  old caches under a stale version are ignored (treated as a miss)
 *  instead of crashing something that tries to read a field that no
 *  longer exists. */
const CACHE_VERSION = 'v1';
const CACHE_PREFIX = '@screen_cache:';

interface CacheEnvelope<T> {
  version: string;
  savedAt: number; // epoch ms
  data: T;
}

export interface CacheReadResult<T> {
  data: T;
  savedAt: number;
  ageMs: number;
}

function storageKey(key: string): string {
  return `${CACHE_PREFIX}${key}`;
}

/** Reads cached data for `key`, or null on a miss, version mismatch, or
 *  corrupt JSON (never throws). */
export async function readCache<T>(key: string): Promise<CacheReadResult<T> | null> {
  try {
    const raw = await AsyncStorage.getItem(storageKey(key));
    if (!raw) return null;

    const parsed = JSON.parse(raw) as CacheEnvelope<T>;
    if (parsed.version !== CACHE_VERSION) return null;

    return { data: parsed.data, savedAt: parsed.savedAt, ageMs: Date.now() - parsed.savedAt };
  } catch (error) {
    console.error(`[screenCache] read failed for "${key}":`, error);
    return null;
  }
}

/** Writes `data` under `key`. Never throws — a failed cache write should
 *  never break the screen that called it. */
export async function writeCache<T>(key: string, data: T): Promise<void> {
  try {
    const envelope: CacheEnvelope<T> = { version: CACHE_VERSION, savedAt: Date.now(), data };
    await AsyncStorage.setItem(storageKey(key), JSON.stringify(envelope));
  } catch (error) {
    console.error(`[screenCache] write failed for "${key}":`, error);
  }
}

export async function clearCache(key: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(storageKey(key));
  } catch (error) {
    console.error(`[screenCache] clear failed for "${key}":`, error);
  }
}

/** True if a cache entry is still within `ttlMs` of being written. Purely
 *  informational for callers that want to decide "is this fresh enough to
 *  skip a spinner" vs "show it but refresh immediately regardless". */
export function isFresh(result: CacheReadResult<unknown> | null, ttlMs: number): boolean {
  return !!result && result.ageMs <= ttlMs;
}
