// src/services/notification/NotificationNavigator.ts
//
// Single responsibility: decide WHERE a notification tap should take the
// user, and get them there safely — no matter how weird/old/malformed the
// notification payload is.
//
// ⚠️ ACTION NEEDED FROM YOU:
// The `pathname` values below are my best guess based on the screens I
// know about (chat, notes, memories, mood, calls, notification center).
// Expo Router paths must match your `app/` folder exactly (case + folder
// structure), so please skim the ROUTE_RESOLVERS map below and correct any
// path that doesn't match your real file structure. Everything else —
// the fallback logic, the "never no route found" guarantee — works
// correctly regardless of what you put there.

import { router } from 'expo-router';
import type { NotificationType } from '../../types/notifications';

// ─── SHAPE OF DATA A NOTIFICATION MIGHT CARRY ────────────────────────────
// This is intentionally loose (lots of optional fields) because 32 notification
// types across years of iteration will never agree on one shape. Treat this
// as "the union of every id we might get", not a strict contract.
export interface NotificationRouteData {
  screen?: string;
  target?: string;
  route?: string;
  params?: Record<string, any>;
  notificationId?: string;
  userId?: string;
  senderId?: string;
  fromUserId?: string;
  chatId?: string;
  taskId?: string;
  reminderId?: string;
  noteId?: string;
  memoryId?: string;
  callId?: string;
  postId?: string;
  targetId?: string;
  groupId?: string;
  [key: string]: any;
}

export interface ResolvedRoute {
  pathname: string;
  params?: Record<string, any>;
  /**
   * true  = confident, real destination (explicit override in the payload,
   *         or a concrete id like taskId/noteId/chatId was resolved)
   * false = generic guess (a bare tab route with no id) or the fallback —
   *         a caller that only wants to navigate on confident matches
   *         (e.g. an in-app list where "nothing to navigate to" should
   *         open an action sheet instead) should treat this as "no route".
   */
  isSpecific: boolean;
}

/** Guaranteed-safe screen to land on when nothing else can be resolved. */
const FALLBACK_ROUTE = { pathname: '/index', isSpecific: false };

/** Absolute last resort if even the fallback route fails to push. */
const ROOT_ROUTE = '/';

type RouteResolver = (data: NotificationRouteData) => ResolvedRoute | null;

// ─── PER-FAMILY RESOLVERS ────────────────────────────────────────────────
const toChat: RouteResolver = (data) => {
  const otherUserId =
    data.senderId ||
    data.fromUserId ||
    data.userId ||
    data.chatId;

  if (!otherUserId) return null;

  return {
    pathname: '/chat/chatroom',
    params: {
      otherUserId,
    },
    isSpecific: true,
  };
};


const toTask: RouteResolver = (data) =>
  data.taskId
    ? {
        pathname: '/index/task',
        params: { taskId: data.taskId },
        isSpecific: true,
      }
    : {
        pathname: '/index/task',
        isSpecific: false,
      };

const toReminder: RouteResolver = (data) =>
  data.reminderId
    ? { pathname: '/index/task', params: { taskId: data.taskId }, isSpecific: true }
    : { pathname: '/index/task', isSpecific: false };

const toNotes: RouteResolver = (data) =>
  data.noteId
    ? { pathname: '/notes', params: { noteId: data.noteId }, isSpecific: true }
    : { pathname: '/notes', isSpecific: false };

const toMemories: RouteResolver = (data) =>
  data.memoryId
    ? { pathname: '/memories', params: { memoryId: data.memoryId }, isSpecific: true }
    : { pathname: '/memories', isSpecific: false };

const toMood: RouteResolver = () => ({ pathname: '/mood-checkin', isSpecific: false });

const toMedia: RouteResolver = () => ({
  pathname: '/vibe',
  params: { tab: 'music' },
  isSpecific: false,
});

const toHome: RouteResolver = () => ({ pathname: '/index', isSpecific: false });

const toDevotional: RouteResolver = () => ({
  pathname: '/index',
  params: { card: 'devotional' },
  isSpecific: false,
});

const toIncomingCall: RouteResolver = (data) =>
  data.callId
    ? { pathname: '/IncomingCallScreen', params: { callId: data.callId }, isSpecific: true }
    : null;

const toCallSummary: RouteResolver = (data) => {
  const otherUserId = data.senderId || data.fromUserId || data.userId;
  return otherUserId
    ? { pathname: '/chat/chatroom', params: { userId: otherUserId }, isSpecific: true }
    : FALLBACK_ROUTE;
};

const toNotificationCenter: RouteResolver = () => ({ pathname: '/index/notification', isSpecific: false });

/**
 * Every value from your `notifications_type_check` DB constraint gets a
 * resolver here. Anything NOT listed (a brand-new type you add later,
 * before you've wired its screen) safely falls through to FALLBACK_ROUTE
 * instead of crashing — see resolveNotificationRoute.
 */
const ROUTE_RESOLVERS: Partial<Record<NotificationType | string, RouteResolver>> = {
  chat: toChat,
  chat_message: toChat,
  message_actions: toChat,

  task: toTask,
  task_actions: toTask,

  reminder: toReminder,
  reminder_actions: toReminder,

  notes: toNotes,
  memories: toMemories,

  mood: toMood,
  now_playing: toMedia,
  media: toMedia,

  morning: toHome,
  night: toHome,
  daily: toHome,
  followup: toHome,
  love_actions: toHome,
  question_actions: toHome,
  encouragement: toHome,

  verse_of_the_day: toDevotional,
  prayer_reminder: toDevotional,
  answered_prayer: toDevotional,
  sermon_reminder: toDevotional,
  praise_reminder: toDevotional,

  incoming_call: toIncomingCall,
  call_accepted: toCallSummary,
  call_ended: toCallSummary,
  call_declined: toCallSummary,
  call_missed: toCallSummary,
  call_cancelled: toCallSummary,

  alert: toNotificationCenter,
  system: toNotificationCenter,
  progress: toNotificationCenter,
  test: toNotificationCenter,
};

/**
 * Resolve a route for a notification. This function NEVER returns
 * null/undefined — it always resolves to something navigable, even for
 * unknown or future notification types.
 *
 * Resolution order:
 *   1. Explicit override in the payload (`screen` / `route` / `target`) —
 *      lets any notification (including ones sent from a backend job)
 *      carry its own destination without a code change here.
 *   2. Type-based resolver from ROUTE_RESOLVERS.
 *   3. Guaranteed fallback (notification center).
 */
export function resolveNotificationRoute(
  type: NotificationType | string | undefined,
  data: NotificationRouteData = {}
): ResolvedRoute {
  const explicitPath = data.screen || data.route || data.target;
  if (explicitPath) {
    return { pathname: explicitPath, params: data.params || {}, isSpecific: true };
  }

  const resolver = type ? ROUTE_RESOLVERS[type] : undefined;
  const resolved = resolver?.(data);
  if (resolved) return resolved;

  return FALLBACK_ROUTE;
}

/**
 * Convenience wrapper for callers (like an in-app notification list) that
 * only want to navigate when there's a confident, specific destination —
 * and want to fall back to their own UI (e.g. an action sheet) otherwise,
 * rather than being pushed to a generic tab or the notification center.
 */
export function hasSpecificNotificationRoute(
  type: NotificationType | string | undefined,
  data: NotificationRouteData = {}
): boolean {
  return resolveNotificationRoute(type, data).isSpecific;
}

/**
 * Safely navigate from a notification tap or action. Wraps router.push in
 * layered try/catches and degrades — resolved route → fallback route →
 * app root — if navigation throws for any reason (e.g. a renamed or
 * not-yet-built screen). This is what guarantees a tap never dead-ends
 * with "no route found".
 */
export function navigateFromNotification(
  type: NotificationType | string | undefined,
  data: NotificationRouteData = {}
): ResolvedRoute {
  const route = resolveNotificationRoute(type, data);

  try {
    router.push({ pathname: route.pathname as any, params: route.params as any });
    return route;
  } catch (primaryError) {
    console.warn('⚠️ Notification navigation failed, falling back:', primaryError);
    try {
      router.push(FALLBACK_ROUTE.pathname as any);
      return FALLBACK_ROUTE;
    } catch (fallbackError) {
      console.error('❌ Fallback navigation also failed:', fallbackError);
      try {
        router.replace(ROOT_ROUTE as any);
      } catch {
        // Nothing more we can do here — the navigator itself is broken.
      }
      return { pathname: ROOT_ROUTE };
    }
  }
}
