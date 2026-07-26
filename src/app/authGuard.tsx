// app/authGuard.ts
// Shared helpers for guest mode + gating account-only features.
// This is a plain .ts utility (no default export), so Expo Router
// will NOT treat it as a route - safe to keep in app/, but you can
// also move it to lib/authGuard.ts if you prefer routes-only in app/.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';

const IS_AUTHENTICATED_KEY = 'is_authenticated';
const GUEST_MODE_KEY = 'guest_mode';

export async function isAuthenticated(): Promise<boolean> {
  const val = await AsyncStorage.getItem(IS_AUTHENTICATED_KEY);
  return val === 'true';
}

export async function isGuest(): Promise<boolean> {
  const val = await AsyncStorage.getItem(GUEST_MODE_KEY);
  return val === 'true';
}

export async function enterAsGuest(): Promise<void> {
  await AsyncStorage.setItem(GUEST_MODE_KEY, 'true');
  await AsyncStorage.removeItem(IS_AUTHENTICATED_KEY);
}

export async function clearGuestMode(): Promise<void> {
  await AsyncStorage.removeItem(GUEST_MODE_KEY);
}

export async function signOut(): Promise<void> {
  await AsyncStorage.removeItem(IS_AUTHENTICATED_KEY);
  await AsyncStorage.removeItem(GUEST_MODE_KEY);
  await AsyncStorage.removeItem('chat_user');
}

/**
 * Call this right before any account-only action - sending a message,
 * opening account settings, editing a profile, etc.
 *
 * - If the person is already authenticated, this resolves `true`
 *   immediately and does nothing else - let the action proceed.
 * - If they're a guest (or have no session), this redirects them to
 *   the welcome/login screen and resolves `false` so the caller can
 *   bail out of the action it was about to run.
 *
 * @param redirectTo the route to send them back to after they log in
 *
 * Usage:
 *   const ok = await requireAuth('/chat');
 *   if (!ok) return;
 *   // ...proceed with the account-only action
 */
export async function requireAuth(redirectTo?: string): Promise<boolean> {
  const authed = await isAuthenticated();
  if (authed) return true;

  const target = redirectTo ? `?redirect=${encodeURIComponent(redirectTo)}` : '';
  router.push(`/welcome${target}` as any);
  return false;
}
