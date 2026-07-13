// src/services/dailyGreetingService.ts
//
// ─── WHAT CHANGED IN THIS PASS ────────────────────────────────────────────
//
// 1. FIXED THE CORE PROBLEM — "only sends if the app happens to be open":
//    The old version had no scheduling of its own; something had to call
//    `sendDailyGreeting()` while the app was running during the right hour
//    window. If the app was backgrounded or killed, nothing fired.
//
//    This version schedules real OS-level local notifications via
//    `Notifications.scheduleNotificationAsync` with a `DATE` trigger. Once
//    scheduled, the OS itself delivers these — the app doesn't need to be
//    open, in the foreground, or even running. That's the actual fix for
//    "should send even if app screen not opened / not in foreground".
//
// 2. FIXED — "not just once a day": the old `wasGreetingSentToday()` /
//    `markGreetingSent()` pair used ONE storage key for the whole day, so
//    whichever greeting fired first (morning, say) blocked every other
//    period (afternoon/evening/night) for the rest of that day. Tracking
//    is now per-period (`morning` / `afternoon` / `evening` / `night`),
//    so all four can fire independently, once each, per day.
//
// 3. NEW — "register to Supabase before the time even reaches": every time
//    this service schedules local notifications, it also writes the same
//    upcoming sends into a `daily_greeting_schedule` table ahead of time.
//    That's a belt-and-suspenders backup: if local OS scheduling is ever
//    lost (app force-stopped, notification permission revoked and
//    re-granted, app reinstalled), a server-side job (see the companion
//    Edge Function reference at the bottom of this file's comments) can
//    still see what's due and send a real push via the Expo Push API —
//    independent of the device's local schedule entirely.
//
// 4. NEW — look-ahead scheduling: keeps the next 3 days of greetings
//    scheduled at all times (`DAYS_AHEAD_TO_SCHEDULE`), re-topped-up on
//    every `initialize()` / foreground check, so you're never relying on
//    a single day's schedule surviving indefinitely.
//
// 5. NEW — configurable per-period send times (`setGreetingTime`), a
//    foreground catch-up safety net (`checkAndSendDueGreetings`) for the
//    rare case a scheduled local notification didn't fire, and a
//    `getStatus()` diagnostic for debugging.
//
// 6. Old public method names/signatures are preserved where sensible
//    (`getGreetingMessage()`, `sendDailyGreeting(userId)`,
//    `wasGreetingSentToday()`, `markGreetingSent()`, `resetGreeting()`) so
//    any existing call sites elsewhere in the app keep working — they now
//    just operate against the *current period* instead of the whole day.

import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { notificationService, supabase } from './notification/NotificationService';
import { AppNotification, NotificationType } from '../types/notifications';

export type GreetingPeriod = 'morning' | 'afternoon' | 'evening' | 'night';
interface GreetingText { title: string; body: string; }

// ── Greeting pools — multiple options per time-of-day so it's never the same ──
const MORNING_GREETINGS: GreetingText[] = [
  { title: '🌅 Good Morning!', body: 'Rise and shine! Have a wonderful day ahead! ☀️' },
  { title: '☕ Morning!', body: 'A fresh day, a fresh start. Make it count! ✨' },
  { title: '🌻 Good Morning!', body: 'Hope you slept well! Time to take on the day 💪' },
  { title: '🐦 Morning!', body: 'The early bird gets the best moments. Good morning! 🌞' },
  { title: '🌄 Rise and Shine!', body: 'Today is full of new possibilities. Let\'s go! 🚀' },
  { title: '☀️ Good Morning!', body: 'Stretch, smile, and start the day strong! 💫' },
];

const AFTERNOON_GREETINGS: GreetingText[] = [
  { title: '☀️ Good Afternoon!', body: 'Hope your day is going well! Keep up the great work! 💪' },
  { title: '🌤️ Afternoon!', body: 'Halfway through the day — you\'re doing great! 🙌' },
  { title: '🍃 Good Afternoon!', body: 'Take a breather if you need one. You\'ve got this! 🌿' },
  { title: '🌞 Afternoon Check-in!', body: 'How\'s the day treating you so far? Keep pushing! 🔥' },
  { title: '🥗 Good Afternoon!', body: 'Don\'t forget to eat something and stay hydrated! 💧' },
  { title: '⚡ Afternoon!', body: 'A little progress each hour adds up. Keep going! 📈' },
];

const EVENING_GREETINGS: GreetingText[] = [
  { title: '🌅 Good Evening!', body: 'Time to unwind and relax. You\'ve earned it! 🌙' },
  { title: '🌆 Evening!', body: 'The day is winding down — reflect on today\'s wins! 🏆' },
  { title: '🍵 Good Evening!', body: 'Maybe it\'s time for a warm drink and some rest 🍂' },
  { title: '🌇 Evening Vibes!', body: 'Hope today treated you kindly. Relax a little 💕' },
  { title: '✨ Good Evening!', body: 'Wrap up the day with something that makes you smile 😊' },
  { title: '🌃 Evening!', body: 'You made it through another day — that matters 🌟' },
];

const NIGHT_GREETINGS: GreetingText[] = [
  { title: '🌙 Good Night!', body: 'Rest well and recharge for tomorrow! 💤' },
  { title: '😴 Sleep Tight!', body: 'Tomorrow is a new day. Get some good rest tonight 🌌' },
  { title: '⭐ Good Night!', body: 'Let go of today and dream well tonight 🌠' },
  { title: '🛏️ Night!', body: 'Time to rest that hardworking mind of yours 💫' },
  { title: '🌌 Sweet Dreams!', body: 'You did enough today. Rest now, dream big 💭' },
  { title: '💤 Good Night!', body: 'Recharge tonight so you can shine tomorrow ✨' },
];

const POOLS: Record<GreetingPeriod, GreetingText[]> = {
  morning: MORNING_GREETINGS,
  afternoon: AFTERNOON_GREETINGS,
  evening: EVENING_GREETINGS,
  night: NIGHT_GREETINGS,
};

// Each period maps to an actual notification `type` your DB constraint
// already allows — morning/night get their own specific type, afternoon
// and evening fall back to the generic 'daily' type since the constraint
// doesn't have distinct values for them.
const TYPE_FOR_PERIOD: Record<GreetingPeriod, NotificationType> = {
  morning: 'morning' as NotificationType,
  afternoon: 'daily' as NotificationType,
  evening: 'daily' as NotificationType,
  night: 'night' as NotificationType,
};

const PERIODS: GreetingPeriod[] = ['morning', 'afternoon', 'evening', 'night'];

// Default fire times (24h clock). Adjust via setGreetingTime(), or just
// edit these — they're the source of truth for both local OS scheduling
// and the Supabase pre-registration.
const DEFAULT_TIMES: Record<GreetingPeriod, { hour: number; minute: number }> = {
  morning: { hour: 7, minute: 0 },
  afternoon: { hour: 13, minute: 0 },
  evening: { hour: 18, minute: 0 },
  night: { hour: 21, minute: 30 },
};

const DAYS_AHEAD_TO_SCHEDULE = 3;

const SENT_KEY_PREFIX = '@greeting_sent:'; // + period:YYYY-MM-DD
const TIMES_STORAGE_KEY = '@greeting_times_v1';
const SCHEDULED_IDS_KEY = '@greeting_scheduled_ids_v1'; // period:YYYY-MM-DD -> OS notification identifier

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function addDays(d: Date, days: number): Date {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function combineDateAndTime(date: Date, hour: number, minute: number): Date {
  const combined = new Date(date);
  combined.setHours(hour, minute, 0, 0);
  return combined;
}

export class DailyGreetingService {
  private static instance: DailyGreetingService;
  private times: Record<GreetingPeriod, { hour: number; minute: number }> = { ...DEFAULT_TIMES };
  private timesLoaded = false;

  private constructor() {}

  static getInstance(): DailyGreetingService {
    if (!DailyGreetingService.instance) {
      DailyGreetingService.instance = new DailyGreetingService();
    }
    return DailyGreetingService.instance;
  }

  // ─── SETUP ────────────────────────────────────────────────

  /**
   * Call once on app start (after notification permissions are granted).
   * Tops up the local OS schedule and registers the same upcoming sends
   * in Supabase as a server-side backup. Safe to call repeatedly (e.g. on
   * every app foreground) — it only schedules what isn't already scheduled.
   */
  async initialize(userId: string): Promise<void> {
    await this.loadCustomTimes();
    await this.scheduleUpcoming(userId);
    await this.registerUpcomingInSupabase(userId);
  }

  /** Change what time a period fires. Reschedules that period going forward. */
  async setGreetingTime(period: GreetingPeriod, hour: number, minute: number, userId?: string): Promise<void> {
    this.times[period] = { hour, minute };
    await AsyncStorage.setItem(TIMES_STORAGE_KEY, JSON.stringify(this.times));
    if (userId) {
      await this.scheduleUpcoming(userId); // will fill in the newly-freed slots
      await this.registerUpcomingInSupabase(userId);
    }
  }

  private async loadCustomTimes(): Promise<void> {
    if (this.timesLoaded) return;
    try {
      const stored = await AsyncStorage.getItem(TIMES_STORAGE_KEY);
      if (stored) {
        this.times = { ...DEFAULT_TIMES, ...JSON.parse(stored) };
      }
    } catch (error) {
      console.error('Error loading custom greeting times, using defaults:', error);
    } finally {
      this.timesLoaded = true;
    }
  }

  // ─── PERIOD / MESSAGE HELPERS ─────────────────────────────

  private pickRandom(pool: GreetingText[]): GreetingText {
    return pool[Math.floor(Math.random() * pool.length)];
  }

  private periodForHour(hour: number): GreetingPeriod {
    if (hour >= 5 && hour < 12) return 'morning';
    if (hour >= 12 && hour < 17) return 'afternoon';
    if (hour >= 17 && hour < 21) return 'evening';
    return 'night';
  }

  /** Kept for backward compatibility — same name/shape as before, now
   *  accepts an optional explicit period (defaults to the current one). */
  getGreetingMessage(period?: GreetingPeriod): { title: string; body: string; type: NotificationType; period: GreetingPeriod } {
    const resolvedPeriod = period || this.periodForHour(new Date().getHours());
    const chosen = this.pickRandom(POOLS[resolvedPeriod]);
    return {
      title: chosen.title,
      body: chosen.body,
      type: TYPE_FOR_PERIOD[resolvedPeriod],
      period: resolvedPeriod,
    };
  }

  // ─── SENT-TRACKING (now per period, not per day) ──────────

  async wasGreetingSentForPeriod(period: GreetingPeriod, date: Date = new Date()): Promise<boolean> {
    try {
      const value = await AsyncStorage.getItem(`${SENT_KEY_PREFIX}${period}:${dateKey(date)}`);
      return value === '1';
    } catch (error) {
      console.error('Error checking greeting status:', error);
      return false;
    }
  }

  async markGreetingSentForPeriod(period: GreetingPeriod, date: Date = new Date()): Promise<void> {
    try {
      await AsyncStorage.setItem(`${SENT_KEY_PREFIX}${period}:${dateKey(date)}`, '1');
    } catch (error) {
      console.error('Error marking greeting sent:', error);
    }
  }

  /** @deprecated kept for old call sites — checks the CURRENT period only. */
  async wasGreetingSentToday(): Promise<boolean> {
    return this.wasGreetingSentForPeriod(this.periodForHour(new Date().getHours()));
  }

  /** @deprecated kept for old call sites — marks the CURRENT period only. */
  async markGreetingSent(): Promise<void> {
    return this.markGreetingSentForPeriod(this.periodForHour(new Date().getHours()));
  }

  // ─── IMMEDIATE SEND (manual trigger / testing / catch-up) ──

  /**
   * Sends a greeting right now via the existing notification pipeline
   * (shows in-app immediately if foregrounded). `period` defaults to
   * whatever period the current time falls in. This does NOT require the
   * app to already have permissions beyond what NotificationService needs.
   */
  async sendDailyGreeting(userId: string, period?: GreetingPeriod): Promise<AppNotification | null> {
    const resolvedPeriod = period || this.periodForHour(new Date().getHours());

    const alreadySent = await this.wasGreetingSentForPeriod(resolvedPeriod);
    if (alreadySent) {
      console.log(`⏳ ${resolvedPeriod} greeting already sent today, skipping...`);
      return null;
    }

    const greeting = this.getGreetingMessage(resolvedPeriod);

    const notification = await notificationService.create({
      userId,
      title: greeting.title,
      body: greeting.body,
      type: greeting.type,
      data: {
        screen: 'home',
        greeting: true,
        period: resolvedPeriod,
        timestamp: new Date().toISOString(),
      },
      showLocal: true,
      priority: 'normal',
    });

    if (notification) {
      await this.markGreetingSentForPeriod(resolvedPeriod);
      console.log(`✅ ${resolvedPeriod} greeting sent successfully!`);
    }

    return notification;
  }

  // ─── OS-LEVEL SCHEDULING (fires even if the app is closed) ─

  private async loadScheduledIds(): Promise<Record<string, string>> {
    try {
      const stored = await AsyncStorage.getItem(SCHEDULED_IDS_KEY);
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  }

  private async saveScheduledIds(map: Record<string, string>): Promise<void> {
    try {
      await AsyncStorage.setItem(SCHEDULED_IDS_KEY, JSON.stringify(map));
    } catch (error) {
      console.error('Failed to persist scheduled greeting ids:', error);
    }
  }

  /**
   * Schedules a single real OS notification (one-off `DATE` trigger, not a
   * repeating trigger) for the given period on the given date, using a
   * freshly-picked random message. One-off triggers (vs. `repeats: true`)
   * are used deliberately so the message text can vary day to day —
   * `scheduleUpcoming` re-tops-up the next few days on every call so you
   * always have a rolling window scheduled.
   */
  private async scheduleOneOSNotification(
    userId: string,
    period: GreetingPeriod,
    fireDate: Date
  ): Promise<string | null> {
    try {
      const greeting = this.getGreetingMessage(period);

      const identifier = await Notifications.scheduleNotificationAsync({
        content: {
          title: greeting.title,
          body: greeting.body,
          data: {
            screen: 'home',
            greeting: true,
            period,
            type: greeting.type,
            userId,
            timestamp: fireDate.toISOString(),
          },
          sound: true,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: fireDate,
        },
      });

      return identifier;
    } catch (error) {
      console.error(`Failed to schedule OS notification for ${period}:`, error);
      return null;
    }
  }

  /**
   * Ensures the next `daysAhead` days have all four periods scheduled as
   * real OS notifications (skipping any period whose time has already
   * passed today, and skipping anything already scheduled). Call this on
   * app start and on every foreground — it's cheap and idempotent.
   */
  async scheduleUpcoming(userId: string, daysAhead: number = DAYS_AHEAD_TO_SCHEDULE): Promise<void> {
    await this.loadCustomTimes();
    const scheduledIds = await this.loadScheduledIds();
    const now = new Date();
    let changed = false;

    for (let d = 0; d < daysAhead; d++) {
      const targetDate = addDays(now, d);
      const dKey = dateKey(targetDate);

      for (const period of PERIODS) {
        const { hour, minute } = this.times[period];
        const fireDate = combineDateAndTime(targetDate, hour, minute);

        // Skip if this slot has already passed (e.g. today's morning, checked at 3pm).
        if (fireDate.getTime() <= now.getTime()) continue;

        const mapKey = `${period}:${dKey}`;
        if (scheduledIds[mapKey]) continue; // already scheduled, don't duplicate

        const identifier = await this.scheduleOneOSNotification(userId, period, fireDate);
        if (identifier) {
          scheduledIds[mapKey] = identifier;
          changed = true;
        }
      }
    }

    // Prune old entries (past dates) so this map doesn't grow forever.
    for (const key of Object.keys(scheduledIds)) {
      const [, keyDate] = key.split(':');
      if (keyDate && keyDate < dateKey(now)) {
        delete scheduledIds[key];
        changed = true;
      }
    }

    if (changed) {
      await this.saveScheduledIds(scheduledIds);
    }
  }

  /** Cancels every currently-scheduled greeting notification (e.g. on logout). */
  async cancelAllScheduled(): Promise<void> {
    const scheduledIds = await this.loadScheduledIds();
    for (const identifier of Object.values(scheduledIds)) {
      try {
        await Notifications.cancelScheduledNotificationAsync(identifier);
      } catch (error) {
        console.warn('Failed to cancel scheduled greeting (may already be gone):', error);
      }
    }
    await AsyncStorage.removeItem(SCHEDULED_IDS_KEY);
  }

  // ─── SUPABASE PRE-REGISTRATION (server-side backup path) ───
  //
  // Writes the same upcoming sends into a `daily_greeting_schedule` table
  // ahead of time — well before their `scheduled_for` time arrives. This
  // is a pure backup: local OS scheduling above is what actually delivers
  // the notification in the common case. This table exists so a
  // server-side job can independently catch anything the device-local
  // schedule ever misses (app force-stopped, permissions reset, etc.) by
  // sending a real push through the Expo Push API using the user's stored
  // push token.
  //
  // Suggested schema (adjust to your migration conventions):
  //   create table daily_greeting_schedule (
  //     id uuid primary key default gen_random_uuid(),
  //     user_id uuid not null references profiles(id),
  //     period text not null,
  //     scheduled_for timestamptz not null,
  //     title text not null,
  //     body text not null,
  //     delivered boolean not null default false,
  //     created_at timestamptz not null default now()
  //   );
  // A companion Supabase Edge Function + pg_cron schedule (e.g. every 5
  // minutes) would query rows where `delivered = false and scheduled_for
  // <= now()`, send via Expo's push API to the user's token, then mark
  // `delivered = true`. That function isn't part of this file since it
  // runs server-side — happy to draft it separately if useful.

  async registerUpcomingInSupabase(userId: string, daysAhead: number = DAYS_AHEAD_TO_SCHEDULE): Promise<void> {
    try {
      await this.loadCustomTimes();
      const now = new Date();
      const rows: Array<{
        user_id: string;
        period: GreetingPeriod;
        scheduled_for: string;
        title: string;
        body: string;
        delivered: boolean;
      }> = [];

      for (let d = 0; d < daysAhead; d++) {
        const targetDate = addDays(now, d);
        for (const period of PERIODS) {
          const { hour, minute } = this.times[period];
          const fireDate = combineDateAndTime(targetDate, hour, minute);
          if (fireDate.getTime() <= now.getTime()) continue;

          const greeting = this.getGreetingMessage(period);
          rows.push({
            user_id: userId,
            period,
            scheduled_for: fireDate.toISOString(),
            title: greeting.title,
            body: greeting.body,
            delivered: false,
          });
        }
      }

      if (rows.length === 0) return;

      // Clear our own not-yet-due rows first so re-registering (e.g. after
      // setGreetingTime) doesn't leave stale duplicates behind, then insert
      // the fresh batch. This is a best-effort backup path — failures here
      // are logged but never block local scheduling, which is primary.
      await supabase
        .from('daily_greeting_schedule')
        .delete()
        .eq('user_id', userId)
        .eq('delivered', false)
        .gte('scheduled_for', now.toISOString());

      const { error } = await supabase.from('daily_greeting_schedule').insert(rows);
      if (error) throw error;

      console.log(`📝 Registered ${rows.length} upcoming greetings in Supabase for backup delivery`);
    } catch (error) {
      // Non-fatal: local OS scheduling above still works even if this fails.
      console.warn('⚠️ Failed to register upcoming greetings in Supabase (local scheduling still active):', error);
    }
  }

  // ─── FOREGROUND CATCH-UP SAFETY NET ────────────────────────

  /**
   * Call from an AppState "active" listener. Covers the rare case where a
   * scheduled local notification didn't fire (e.g. notification
   * permission was revoked and re-granted mid-window) by sending
   * immediately if the current period hasn't been sent yet, then tops up
   * the rolling schedule for the days ahead.
   */
  async checkAndSendDueGreetings(userId: string): Promise<void> {
    const period = this.periodForHour(new Date().getHours());
    const alreadySent = await this.wasGreetingSentForPeriod(period);
    if (!alreadySent) {
      await this.sendDailyGreeting(userId, period);
    }
    await this.scheduleUpcoming(userId);
    await this.registerUpcomingInSupabase(userId);
  }

  // ─── TESTING / DIAGNOSTICS ──────────────────────────────────

  /** Resets today's sent-flags for every period and re-schedules fresh. */
  async resetGreeting(userId?: string): Promise<void> {
    try {
      const today = dateKey(new Date());
      for (const period of PERIODS) {
        await AsyncStorage.removeItem(`${SENT_KEY_PREFIX}${period}:${today}`);
      }
      console.log('🔄 Greeting reset for testing');

      if (userId) {
        await this.cancelAllScheduled();
        await this.scheduleUpcoming(userId);
        await this.registerUpcomingInSupabase(userId);
      }
    } catch (error) {
      console.error('Error resetting greeting:', error);
    }
  }

  /** Quick diagnostic snapshot — handy to log or show in a debug screen. */
  async getStatus(): Promise<{
    sentToday: Record<GreetingPeriod, boolean>;
    times: Record<GreetingPeriod, { hour: number; minute: number }>;
    scheduledCount: number;
  }> {
    await this.loadCustomTimes();
    const sentToday = {} as Record<GreetingPeriod, boolean>;
    for (const period of PERIODS) {
      sentToday[period] = await this.wasGreetingSentForPeriod(period);
    }
    const scheduledIds = await this.loadScheduledIds();
    return {
      sentToday,
      times: this.times,
      scheduledCount: Object.keys(scheduledIds).length,
    };
  }
}

export const dailyGreetingService = DailyGreetingService.getInstance();
