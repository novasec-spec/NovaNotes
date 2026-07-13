// src/hooks/useDailyGreeting.ts
//
// ─── WHAT CHANGED ─────────────────────────────────────────────────────────
// dailyGreetingService now does real work beyond "send one greeting right
// now" — it schedules OS-level notifications (so greetings fire even with
// the app closed) and registers a Supabase-side backup. Neither of those
// happened automatically before; something had to call them. This hook is
// the natural place, since it's already the thing screens use to hook into
// the greeting system.
//
// New behavior:
//   1. On mount (once `user.id` is available), calls
//      `dailyGreetingService.initialize(user.id)` — tops up the next few
//      days of OS-scheduled greetings and registers the Supabase backup.
//      This does NOT show a notification immediately; it just schedules
//      future ones. Nothing changes about what you see on app load.
//   2. Adds an AppState listener: whenever the app comes to the
//      foreground, it calls `checkAndSendDueGreetings` — a safety net that
//      sends the current period's greeting if it somehow didn't fire, and
//      keeps the rolling schedule topped up.
//   3. `resetGreeting()` now passes `user.id` through so a reset also
//      cancels + reschedules the OS notifications, not just the
//      "sent today" flags.
//   4. New `status` state (via `dailyGreetingService.getStatus()`) if you
//      want to show per-period sent/scheduled info anywhere for debugging.
//
// Everything this hook returned before still returns the same shape —
// `sendGreeting`, `sendGreetingOnAppLoad`, `resetGreeting`,
// `checkGreetingStatus`, `greetingSent`, `lastGreeting`, `loading` all work
// exactly as they did.

import { useEffect, useState, useCallback, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { dailyGreetingService, GreetingPeriod } from '../services/dailyGreetingService';
import { useNotification } from '../contexts/NotificationContext';
import { AppNotification } from '../types/notifications';

interface GreetingStatus {
  sentToday: Record<GreetingPeriod, boolean>;
  times: Record<GreetingPeriod, { hour: number; minute: number }>;
  scheduledCount: number;
}

export function useDailyGreeting() {
  const { user } = useAuth();
  const { sendNotification } = useNotification();
  const [loading, setLoading] = useState(false);
  const [greetingSent, setGreetingSent] = useState(false);
  const [lastGreeting, setLastGreeting] = useState<AppNotification | null>(null);
  const [status, setStatus] = useState<GreetingStatus | null>(null);
  const initializedRef = useRef(false);

  // Check if greeting was sent today (current period)
  const checkGreetingStatus = useCallback(async () => {
    if (!user?.id) return;

    try {
      const sent = await dailyGreetingService.wasGreetingSentToday();
      setGreetingSent(sent);
    } catch (error) {
      console.error('Error checking greeting status:', error);
    }
  }, [user?.id]);

  const refreshStatus = useCallback(async () => {
    try {
      const s = await dailyGreetingService.getStatus();
      setStatus(s);
    } catch (error) {
      console.error('Error fetching greeting status snapshot:', error);
    }
  }, []);

  // Send daily greeting
  const sendGreeting = useCallback(async () => {
    if (!user?.id) {
      console.error('❌ No user to send greeting');
      return null;
    }

    setLoading(true);

    try {
      const notification = await dailyGreetingService.sendDailyGreeting(user.id);

      if (notification) {
        setLastGreeting(notification);
        setGreetingSent(true);
        console.log('✅ Daily greeting sent!');
        return notification;
      } else {
        console.log('⏳ No greeting sent (already sent today or error)');
        return null;
      }
    } catch (error) {
      console.error('❌ Error sending greeting:', error);
      return null;
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  // Auto-send greeting on app load (optional)
  const sendGreetingOnAppLoad = useCallback(async () => {
    if (!user?.id) return null;

    const alreadySent = await dailyGreetingService.wasGreetingSentToday();

    if (!alreadySent) {
      console.log('🌅 Sending daily greeting on app load...');
      return await sendGreeting();
    } else {
      console.log('⏳ Greeting already sent today');
      return null;
    }
  }, [user?.id, sendGreeting]);

  // Reset greeting (for testing) — now also cancels + reschedules the
  // real OS notifications when a user is available, not just the flags.
  const resetGreeting = useCallback(async () => {
    await dailyGreetingService.resetGreeting(user?.id);
    setGreetingSent(false);
    setLastGreeting(null);
    await refreshStatus();
    console.log('🔄 Greeting reset');
  }, [user?.id, refreshStatus]);

  // ─── ONE-TIME SETUP: schedule OS notifications + Supabase backup ──
  useEffect(() => {
    if (!user?.id || initializedRef.current) return;
    initializedRef.current = true;

    (async () => {
      try {
        await dailyGreetingService.initialize(user.id);
        await refreshStatus();
      } catch (error) {
        console.error('Error initializing daily greeting schedule:', error);
      }
    })();
  }, [user?.id, refreshStatus]);

  // Reset the init guard if the user changes (e.g. logout -> different login)
  useEffect(() => {
    return () => {
      initializedRef.current = false;
    };
  }, [user?.id]);

  // ─── FOREGROUND CATCH-UP ────────────────────────────────────────────
  useEffect(() => {
    if (!user?.id) return;

    const handleAppStateChange = (nextState: AppStateStatus) => {
      if (nextState === 'active') {
        dailyGreetingService
          .checkAndSendDueGreetings(user.id)
          .then(() => {
            checkGreetingStatus();
            refreshStatus();
          })
          .catch((error) => console.error('Error during greeting catch-up:', error));
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, [user?.id, checkGreetingStatus, refreshStatus]);

  // Check status on mount
  useEffect(() => {
    checkGreetingStatus();
    refreshStatus();
  }, [checkGreetingStatus, refreshStatus]);

  return {
    loading,
    greetingSent,
    lastGreeting,
    status,
    sendGreeting,
    sendGreetingOnAppLoad,
    resetGreeting,
    checkGreetingStatus,
    refreshStatus,
  };
}
